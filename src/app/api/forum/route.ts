import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { ApiError, apiFailure, authenticatedUser, idempotentTransaction } from '@/lib/server-api';
import { readLimitedJson } from '@/lib/server-json';
import { forumPostSchema } from '@/lib/public-firestore-schema';
import { prepareRequestBudget } from '@/lib/request-budget';

export const runtime = 'nodejs';
const Input = z.object({ title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20000), subject: z.string().trim().min(1).max(100), requestId: z.string().uuid() }).strict();
export async function POST(request: NextRequest) {
  try {
    const uid = await authenticatedUser(request);
    const { requestId, ...input } = Input.parse(await readLimitedJson(request, 96_000));
    const user = await getAdminAuth().getUser(uid);
    const data = forumPostSchema.parse({ ...input, authorId: uid, authorName: user.displayName || 'Learner', authorPhoto: user.photoURL || '', createdAt: null, likesCount: 0, likedBy: [], commentsCount: 0 });
    const db = getAdminDb();
    const ref = db.collection('posts').doc();
    const result = await idempotentTransaction('post-create', uid, requestId, input, async transaction => {
      const tombstone = await transaction.get(db.collection('_forumDeletions').doc(ref.id));
      if (tombstone.exists) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Please start a new post request.');
      const commitBudget = await prepareRequestBudget(transaction, uid, 'post-create', Buffer.byteLength(JSON.stringify(input)));
      commitBudget();
      transaction.create(ref, { ...data, createdAt: FieldValue.serverTimestamp() });
      return { id: ref.id };
    });
    return NextResponse.json(result, { status: 201 });
  } catch (error) { return apiFailure(error); }
}
