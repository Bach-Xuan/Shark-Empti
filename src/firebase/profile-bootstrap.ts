import type { User } from 'firebase/auth';
import { deleteField, doc, runTransaction, serverTimestamp, type Firestore } from 'firebase/firestore';

/** Restore a usable public profile without resetting drafts or server-owned coins. */
export async function ensureLearnerProfile(db: Firestore, user: User) {
  const ref = doc(db, 'users', user.uid);
  await runTransaction(db, async transaction => {
    const snapshot = await transaction.get(ref);
    const current = snapshot.data();
    const patch: Record<string, unknown> = {};
    if (typeof current?.displayName !== 'string' || !current.displayName.trim()) patch.displayName = user.displayName || 'Learner';
    if (typeof current?.photoURL !== 'string') patch.photoURL = user.photoURL || '';
    if (!current?.createdAt) patch.createdAt = serverTimestamp();
    // Email stays in owner-only Firebase Auth, never in the shared profile.
    if (current && Object.hasOwn(current, 'email')) patch.email = deleteField();
    if (Object.keys(patch).length) transaction.set(ref, { ...patch, updatedAt: serverTimestamp() }, { merge: true });
  });
}
