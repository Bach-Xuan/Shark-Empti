import { getAdminDb } from '@/lib/firebase-admin';
import { deleteForumPostTree } from '@/lib/forum-deletion';
import { ApiError, apiFailure, authenticatedUser, idempotentTransaction } from '@/lib/server-api';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { FieldValue } from 'firebase-admin/firestore';
import { requireDocumentId } from '@/lib/forum-deletion';
import { readLimitedJson } from '@/lib/server-json';
import { readForumPost, readForumComment } from '@/lib/public-firestore-schema';
import { enforceRequestBudget, prepareRequestBudget } from '@/lib/request-budget';
import { prepareOwnForumReaction } from '@/lib/forum-reaction-owner';
import { prepareForumPublication } from '@/lib/forum-publication';

export const runtime = 'nodejs';

const Mutation = z.discriminatedUnion('action', [
  z.object({ action: z.literal('edit-post'), title: z.string().trim().min(1).max(200), content: z.string().trim().min(1).max(20000), subject: z.string().trim().min(1).max(100) }).strict(),
  z.object({ action: z.literal('edit-comment'), commentId: z.string().min(1).max(1500), content: z.string().trim().min(1).max(2000) }).strict(),
  z.object({ action: z.literal('like'), commentId: z.string().min(1).max(1500).optional(), liked: z.boolean() }).strict(),
]);
const Input = z.object({ requestId: z.string().uuid(), mutation: Mutation }).strict();

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'community-traffic');
    const { postId } = await params;
    requireDocumentId(postId);
    const { requestId, mutation } = Input.parse(await readLimitedJson(request, 96_000));
    if ('commentId' in mutation && mutation.commentId) requireDocumentId(mutation.commentId);
    const db = getAdminDb();
    const result = await idempotentTransaction(`forum-mutate/${postId}`, uid, requestId, mutation, async transaction => {
      const postRef = db.collection('posts').doc(postId);
      const [post, deletion] = await Promise.all([transaction.get(postRef), transaction.get(db.collection('_forumDeletions').doc(postId))]);
      if (!post.exists || deletion.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');
      const commentId = 'commentId' in mutation ? mutation.commentId : undefined;
      const ref = commentId ? postRef.collection('comments').doc(commentId) : postRef;
      const snapshot = commentId ? await transaction.get(ref) : post;
      const data = commentId ? readForumComment(ref.id, snapshot.data()) : readForumPost(postId, snapshot.data());
      if (!snapshot.exists || !data) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post or comment not found.');
      const publication = await prepareForumPublication(transaction, db, ref.path);
      const updatedAt = mutation.action === 'like' ? undefined : FieldValue.serverTimestamp();
      let patch: Record<string, unknown>;
      let commitOwnReaction: (() => void) | undefined;
      if (mutation.action === 'like') {
        const likedBy = new Set(data.likedBy ?? []);
        const unchanged = likedBy.has(uid) === mutation.liked;
        mutation.liked ? likedBy.add(uid) : likedBy.delete(uid);
        if (mutation.liked && !unchanged && likedBy.size > 2000) throw new ApiError('APP-RATE-LIMITED', 429, 'This item has reached its reaction limit.');
        patch = unchanged ? {} : { likedBy: [...likedBy], likesCount: likedBy.size };
        commitOwnReaction = await prepareOwnForumReaction(transaction, db, uid, { postId, ...(commentId ? { commentId } : {}) }, mutation.liked);
      } else {
        if (data.authorId !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot edit this content.');
        patch = mutation.action === 'edit-post' ? { title: mutation.title, content: mutation.content, subject: mutation.subject } : { content: mutation.content };
        patch.updatedAt = updatedAt;
      }
      const commitBudget = await prepareRequestBudget(transaction, uid, 'community-mutate', Buffer.byteLength(JSON.stringify(mutation)));
      commitBudget();
      commitOwnReaction?.();
      if (Object.keys(patch).length) transaction.update(ref, patch);
      publication.write({ ...snapshot.data(), ...patch }, updatedAt);
      return { ok: true };
    });
    return NextResponse.json(result);
  } catch (error) { return apiFailure(error); }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ postId: string }> }) {
  try {
    const uid = await authenticatedUser(request);
    await enforceRequestBudget(uid, 'community-traffic');
    await deleteForumPostTree(getAdminDb(), (await params).postId, uid);
    return NextResponse.json({ ok: true });
  } catch (error) { return apiFailure(error); }
}
