import type { User } from 'firebase/auth';
import { deleteField, doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';
import { PROFILE_LIMITS } from '@/lib/data-limits';

const validName = (value: unknown): value is string => typeof value === 'string' && !!value.trim() && value.length <= PROFILE_LIMITS.displayName;
const validPhoto = (value: unknown): value is string => typeof value === 'string' && value.length <= PROFILE_LIMITS.photoURL && (value === '' || /^https?:\/\//i.test(value));

/** Restore a usable public profile without resetting drafts or server-owned coins. */
export async function ensureLearnerProfile(db: Firestore, user: User) {
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const patch: Record<string, unknown> = {};
    if (!validName(current?.displayName)) patch.displayName = validName(user.displayName) ? user.displayName : 'Learner';
    if (!validPhoto(current?.photoURL)) patch.photoURL = validPhoto(user.photoURL) ? user.photoURL : '';
    if (!current?.createdAt) patch.createdAt = serverTimestamp();
    // Email stays in owner-only Firebase Auth, never in the shared profile.
    if (current && Object.hasOwn(current, 'email')) patch.email = deleteField();
    if (Object.keys(patch).length) transaction.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  });
}
