import 'server-only';
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
import { ApiError, assertWritable } from './server-api';
import { isDocumentId } from './document-id';
import { readDescendantPage } from './firestore-descendants';
import { PUBLIC_FORUM_COLLECTION } from './community-privacy';

export function requireDocumentId(id: string) {
  if (!isDocumentId(id))
    throw new ApiError('APP-INVALID-INPUT', 400, 'Invalid document ID.');
}

/** Atomic visibility cutover, followed by bounded, transactionally guarded cleanup.
 * The private tombstone survives partial failures and permanently prevents ID reuse.
 * Retrying DELETE is owner-only even after the parent document is gone.
 */
export async function deleteForumPostTree(db: Firestore, postId: string, uid: string) {
  requireDocumentId(postId);
  const postRef = db.collection('posts').doc(postId);
  const publicRef = db.collection(PUBLIC_FORUM_COLLECTION).doc(postId);
  const markerRef = db.collection('_forumDeletions').doc(postId);
  const complete = await db.runTransaction(async transaction => {
    await assertWritable(transaction, uid);
    const [post, marker] = await Promise.all([transaction.get(postRef), transaction.get(markerRef)]);
    const authorId = marker.exists ? marker.get('authorId') : post.get('authorId');
    if (!marker.exists && !post.exists) throw new ApiError('FORUM-NOT-FOUND', 404, 'Post not found.');
    if (authorId !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot delete this post.');
    if (marker.get('status') === 'complete') return true;
    if (!marker.exists) transaction.create(markerRef, { authorId: uid, status: 'pending', createdAt: FieldValue.serverTimestamp() });
    transaction.delete(postRef);
    transaction.delete(publicRef);
    return false;
  });
  if (complete) return;
  // Query only names, then recheck authority/barriers in the deleting transaction.
  // Re-enumerating the remaining prefix preserves arbitrary legacy descendants,
  // including those below missing parents, without a fragile positional cursor.
  for (;;) {
    const privatePaths = await readDescendantPage(db, postRef, 100);
    const paths = privatePaths.length ? privatePaths : await readDescendantPage(db, publicRef, 100);
    const finished = await db.runTransaction(async transaction => {
      await assertWritable(transaction, uid);
      const marker = await transaction.get(markerRef);
      if (!marker.exists || marker.get('authorId') !== uid) throw new ApiError('AUTH-FORBIDDEN', 403, 'You cannot delete this post.');
      if (marker.get('status') === 'complete') return true;
      if (paths.length === 0) {
        transaction.update(markerRef, { status: 'complete', completedAt: FieldValue.serverTimestamp() });
        return true;
      }
      for (const path of paths) transaction.delete(db.doc(path));
      return false;
    });
    if (finished) return;
  }
}
