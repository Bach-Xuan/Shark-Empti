import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ApiError } from './server-api';

export function requireDocumentId(id: string) {
  if (!id || id === '.' || id === '..' || id.includes('/') || id.length > 128)
    throw new ApiError('APP-INVALID-INPUT', 400, 'Invalid document ID.');
}

/** Atomic visibility cutover, followed by Admin SDK's paginated recursive deletion.
 * The private tombstone survives partial failures and permanently prevents ID reuse.
 * Retrying DELETE is owner-only even after the parent document is gone.
 */
export async function deleteForumPostTree(db: Firestore, postId: string, uid: string) {
  requireDocumentId(postId);
  const postRef = db.collection('posts').doc(postId);
  const markerRef = db.collection('_forumDeletions').doc(postId);
  const complete = await db.runTransaction(async transaction => {
    const [post, marker] = await Promise.all([transaction.get(postRef), transaction.get(markerRef)]);
    const authorId = marker.exists ? marker.get('authorId') : post.get('authorId');
    if (!marker.exists && !post.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post not found.');
    if (authorId !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot delete this post.');
    if (marker.get('status') === 'complete') return true;
    if (!marker.exists) transaction.create(markerRef, { authorId: uid, status: 'pending', createdAt: FieldValue.serverTimestamp() });
    transaction.delete(postRef);
    return false;
  });
  if (complete) return;
  // Each retry re-enumerates descendants, so a failed bulk write is recoverable.
  // Parent absence gates public access and transactional comment creation meanwhile.
  await db.recursiveDelete(postRef);
  await markerRef.update({ status: 'complete', completedAt: FieldValue.serverTimestamp() });
}
