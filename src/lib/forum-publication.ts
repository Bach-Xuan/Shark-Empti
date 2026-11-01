import 'server-only';
import type { FieldValue, Firestore, Transaction } from 'firebase-admin/firestore';
import { COMMUNITY_PRIVACY_VERSION, PUBLIC_FORUM_COLLECTION } from './community-privacy';
import { projectForumMetadata } from './community-projections';

/** Only exact canonical Forum paths can address a public projection. */
export function forumPublicReference(db: Firestore, path: string) {
  const parts = path.split('/');
  if (parts[0] !== 'posts' || (parts.length !== 2 && !(parts.length === 4 && parts[2] === 'comments'))) return null;
  return db.doc([PUBLIC_FORUM_COLLECTION, ...parts.slice(1)].join('/'));
}

/** Read before any writes. Existing projections mean membership backfill has
 * completed; ordinary edits must not publish an unconverted legacy item. */
export async function prepareForumPublication(transaction: Transaction, db: Firestore, path: string) {
  const ref = forumPublicReference(db, path);
  const snapshot = ref ? await transaction.get(ref) : null;
  const published = snapshot?.exists === true && snapshot.get('privacyVersion') === COMMUNITY_PRIVACY_VERSION;
  return {
    published,
    write(value: unknown, updatedAt?: FieldValue) {
      if (!ref || !published) return;
      const projected = projectForumMetadata(value, path.split('/').length === 2 ? 'post' : 'comment');
      if (projected) transaction.set(ref, { ...projected, ...(updatedAt ? { updatedAt } : {}) });
      else transaction.delete(ref); // Corrupt private input cannot retain stale public identity.
    },
    remove() { if (ref) transaction.delete(ref); },
  };
}
