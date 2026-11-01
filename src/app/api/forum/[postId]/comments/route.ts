import { getAdminAuth,getAdminDb } from '@/lib/firebase-admin';
import { requireDocumentId } from '@/lib/forum-deletion';
import { readForumPost, forumCommentSchema } from '@/lib/public-firestore-schema';
import { readLimitedJson } from '@/lib/server-json';
import { ApiError,apiFailure,authenticatedUser,idempotentTransaction,assertWritable } from '@/lib/server-api';
import { FieldValue } from 'firebase-admin/firestore';
import { NextRequest,NextResponse } from 'next/server';
import { z } from 'zod';
import { enforceRequestBudget, prepareRequestBudget } from '@/lib/request-budget';
import { prepareForumPublication, forumPublicReference } from '@/lib/forum-publication';
import { projectForumMetadata } from '@/lib/community-projections';

export const runtime = 'nodejs';

const CommentSchema = z.object({ content: z.string().trim().min(1).max(2000), requestId: z.string().uuid().optional() });

export async function POST(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'community-traffic');
    const { content, requestId } = CommentSchema.parse(await readLimitedJson(request, 16_384));
    const { postId } = await params;
    requireDocumentId(postId);
    const db = getAdminDb();
    const user = await getAdminAuth().getUser(uid);
    const commentData = forumCommentSchema.parse({ content, authorId: uid,
      authorName: user.displayName || 'Learner', authorPhoto: user.photoURL || '',
      createdAt: null, likesCount: 0, likedBy: [],
    });
    await idempotentTransaction(`comments/${postId}`, uid, requestId, { content }, async transaction => {
      const postRef = db.collection('posts').doc(postId);
      const [post, deletion] = await Promise.all([transaction.get(postRef), transaction.get(db.collection('_forumDeletions').doc(postId))]);
      if (!post.exists || deletion.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');
      const parsed = readForumPost(postId, post.data());
      if (!parsed) throw new ApiError('FORUM-INVALID-POST', 409, 'This post cannot accept comments.');
      const publication = await prepareForumPublication(transaction, db, postRef.path);

      const commitBudget = await prepareRequestBudget(transaction, uid, 'comment-create', Buffer.byteLength(content));
      commitBudget();
      const commentRef = postRef.collection('comments').doc();
      transaction.create(commentRef, {
        ...commentData,
        postId,
        createdAt: FieldValue.serverTimestamp(),
      });
      transaction.create(forumPublicReference(db, commentRef.path)!, { ...projectForumMetadata(commentData, 'comment')!, createdAt: FieldValue.serverTimestamp() });
      if (parsed.commentsCount >= Number.MAX_SAFE_INTEGER) throw new ApiError('FORUM-INVALID-POST', 409, 'Comment limit reached.');
      transaction.update(postRef, { commentsCount: parsed.commentsCount + 1 });
      publication.write({ ...post.data(), commentsCount: parsed.commentsCount + 1 });
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
    await enforceRequestBudget(uid, 'community-traffic');
    const commentId = new URL(request.url).searchParams.get('commentId');
    if (!commentId || commentId.includes('/')) throw new ApiError('APP-INVALID-INPUT', 400, 'Comment ID is required.');
    const { postId } = await params;
    requireDocumentId(postId);
    requireDocumentId(commentId);
    const db = getAdminDb();
    await db.runTransaction(async transaction => {
      await assertWritable(transaction, uid);
      const postRef = db.collection('posts').doc(postId);
      const commentRef = postRef.collection('comments').doc(commentId);
      const [post, comment, deletion] = await Promise.all([transaction.get(postRef), transaction.get(commentRef), transaction.get(db.collection('_forumDeletions').doc(postId))]);
      if (!post.exists || !comment.exists || deletion.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');
      const parsed = readForumPost(postId, post.data());
      if (!parsed) throw new ApiError('FORUM-INVALID-POST', 409, 'This post cannot be updated.');
      if (comment.get('authorId') !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot delete this comment.');
      const publication = await prepareForumPublication(transaction, db, postRef.path);

      transaction.delete(commentRef);
      transaction.delete(forumPublicReference(db, commentRef.path)!);
      transaction.update(postRef, { commentsCount: Math.max(0, parsed.commentsCount - 1) });
      publication.write({ ...post.data(), commentsCount: Math.max(0, parsed.commentsCount - 1) });
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiFailure(error);
  }
}
