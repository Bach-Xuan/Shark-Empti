import 'server-only';
import type { Firestore, Transaction } from 'firebase-admin/firestore';
import { z } from 'zod';
import { ARENA_RANKINGS_COLLECTION } from './community-privacy';
import { projectArenaRanking } from './community-projections';

export function arenaPublicReference(db: Firestore, path: string, value: Record<string, unknown>) {
  const parts = path.split('/'), parsed = z.string().uuid().safeParse(value.publicId);
  if (parts.length !== 4 || parts[0] !== 'arenaExams' || parts[2] !== 'attempts' || !parsed.success || parsed.data === value.userId) return null;
  return db.collection('arenaExams').doc(parts[1]).collection(ARENA_RANKINGS_COLLECTION).doc(parsed.data);
}
export async function prepareArenaPublication(transaction: Transaction, db: Firestore, path: string, value: Record<string, unknown>) {
  const ref = arenaPublicReference(db, path, value), current = ref ? await transaction.get(ref) : null;
  return (next: Record<string, unknown>) => {
    if (!ref || !current?.exists) return;
    const projected = projectArenaRanking(next);
    if (projected) transaction.set(ref, projected); else transaction.delete(ref);
  };
}
