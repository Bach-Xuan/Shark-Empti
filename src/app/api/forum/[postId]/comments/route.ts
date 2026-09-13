import { getAdminAuth,getAdminDb } from '@/lib/firebase-admin';
import { ApiError,apiFailure,authenticatedUser,idempotentTransaction } from '@/lib/server-api';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';

export const runtime = 'nodejs';

const CommentSchema = z.object({ content: z.string().trim().min(1).max(2000), requestId: z.string().uuid().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const { content, requestId } = CommentSchema.parse(await request.json());
    const { postId } = await params;
    const db = getAdminDb();
    const user = await getAdminAuth().getUser(uid);
    await idempotentTransaction(`comments/${postId}`, uid, requestId, { content }, async transaction => {
      const postRef = db.collection('posts').doc(postId);
      const post = await transaction.get(postRef);
      if (!post.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');

      transaction.create(postRef.collection('comments').doc(), {
        postId,
        content,
        authorId: uid,
        authorName: user.displayName || 'Learner',
        authorPhoto: user.photoURL || '',
        createdAt: FieldValue.serverTimestamp(),
        likesCount: 0,
        likedBy: [],
      });
      const commentsCount = post.get('commentsCount');
      transaction.update(postRef, { commentsCount: typeof commentsCount === 'number' ? commentsCount + 1 : 1 });
      return { ok: true };
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return apiFailure(error);
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    const commentId = new URL(request.url).searchParams.get('commentId');
    if (!commentId || commentId.includes('/')) throw new ApiError('APP-INVALID-INPUT', 400, 'Comment ID is required.');
    const { postId } = await params;
    const db = getAdminDb();
    await db.runTransaction(async transaction => {
      const postRef = db.collection('posts').doc(postId);
      const commentRef = postRef.collection('comments').doc(commentId);
      const [post, comment] = await Promise.all([transaction.get(postRef), transaction.get(commentRef)]);
      if (!post.exists || !comment.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');
      if (comment.get('authorId') !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot delete this comment.');

      const commentsCount = post.get('commentsCount');
      transaction.delete(commentRef);
      transaction.update(postRef, { commentsCount: Math.max(0, typeof commentsCount === 'number' ? commentsCount - 1 : 0) });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
