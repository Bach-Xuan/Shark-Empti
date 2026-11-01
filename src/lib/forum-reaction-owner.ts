import 'server-only';
import { FieldValue, type Firestore, type Transaction } from 'firebase-admin/firestore';
import { COMMUNITY_PRIVACY_VERSION, FORUM_REACTIONS_COLLECTION, forumReactionId, ownForumReactionSchema, type ForumReactionTarget } from './community-privacy';
import { ApiError } from './server-api';

/** Prepare before any transaction writes. An old private record at the reserved
 * path is a conflict, never permission to erase unrelated owner data. */
export async function prepareOwnForumReaction(transaction: Transaction, db: Firestore, uid: string, target: ForumReactionTarget, liked: boolean, options: { preserveExisting?: boolean } = {}) {
  const id = await forumReactionId(target);
  const ref = db.collection('users').doc(uid).collection(FORUM_REACTIONS_COLLECTION).doc(id);
  const current = await transaction.get(ref);
  if (current.exists) {
    const parsed = ownForumReactionSchema.safeParse(current.data());
    if (!parsed.success || parsed.data.postId !== target.postId || parsed.data.commentId !== target.commentId) {
      throw new ApiError('APP-REQUEST-CONFLICT', 409, 'This reaction needs a data compatibility review.');
    }
  }
  return () => {
    if (options.preserveExisting && liked === current.exists) return false;
    if (liked) transaction.set(ref, { ...target, liked: true, privacyVersion: COMMUNITY_PRIVACY_VERSION, updatedAt: FieldValue.serverTimestamp() });
    else transaction.delete(ref);
    return true;
  };
}
