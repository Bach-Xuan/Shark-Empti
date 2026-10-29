import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, authenticatedUser, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { reportTargetSchema, targetReference } from '@/lib/community-moderation';
import { prepareRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
const Input = z.object({ target: reportTargetSchema, reason: z.string().trim().min(5).max(2000), requestId: z.string().uuid() }).strict();
export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    const { requestId, ...input } = Input.parse(await readLimitedJson(request, 16_384));
    const db = getAdminDb();
    const target = targetReference(db, input.target);
    const report = db.collection('_communityReports').doc();
    const result = await idempotentTransaction('community-report', uid, requestId, input, async transaction => {
      const snapshot = await transaction.get(target);
      if (!snapshot.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Content not found.');
      if (input.target.kind === 'comment') {
        const [parent, deletion] = await Promise.all([transaction.get(db.collection('posts').doc(input.target.parentId)), transaction.get(db.collection('_forumDeletions').doc(input.target.parentId))]);
        if (!parent.exists || deletion.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Content not found.');
      }
      const commitBudget = await prepareRequestBudget(transaction, uid, 'community-report');
      commitBudget();
      transaction.create(report, { ...input, reporterId: uid, status: 'open', createdAt: FieldValue.serverTimestamp() });
      return { id: report.id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiFailure(error); }
}
