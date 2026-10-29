import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { arenaConfigSchema, arenaExamSchema, arenaQuestionSchema } from '@/lib/public-firestore-schema';
import { apiFailure, authenticatedUser, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prepareRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
const createSchema = z.object({
  title: z.string().trim().min(1).max(200), config: arenaConfigSchema,
  questions: z.array(arenaQuestionSchema).min(1).max(50),
  requestId: z.string().uuid(),
}).strict();

export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    const { requestId, ...input } = createSchema.parse(await readLimitedJson(request, 900_000));
    const user = await getAdminAuth().getUser(uid);
    const exam = arenaExamSchema.parse({ ...input, authorId: uid,
      authorName: user.displayName || 'Learner', authorPhoto: user.photoURL || '',
      totalAttempts: 0, createdAt: new Date(),
    });
    // Remove optional undefined properties before sending the validated wire record.
    const data = JSON.parse(JSON.stringify(exam));
    const examRef = getAdminDb().collection('arenaExams').doc();
    const result = await idempotentTransaction('arena-create', uid, requestId, input, async transaction => {
      const commitBudget = await prepareRequestBudget(transaction, uid, 'arena-create', Buffer.byteLength(JSON.stringify(input)));
      const { questions, ...metadata } = data;
      commitBudget();
      transaction.create(examRef, { ...metadata, schemaVersion: 2, questionCount: questions.length, practiceOnly: false, firstRewardClaimed: false, createdAt: FieldValue.serverTimestamp() });
      transaction.create(getAdminDb().collection('_arenaAnswerKeys').doc(examRef.id), { schemaVersion: 2, authorId: uid, questions, createdAt: FieldValue.serverTimestamp() });
      return { id: examRef.id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiFailure(error); }
}
