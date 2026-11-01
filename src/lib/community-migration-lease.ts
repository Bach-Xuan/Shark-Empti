import 'server-only';
import { randomUUID } from 'node:crypto';
import type { Firestore, Transaction } from 'firebase-admin/firestore';

const LIFETIME_MS = 5 * 60_000;
export class CommunityRecordConflict extends Error {}
export type CommunityMigrationLease = { id: string; isolatedRestore: boolean };

/** Existing business/SDK guards and the worker fence already honor these two
 * records. An expired lease is never resumed; a fresh run re-enumerates data. */
export async function acquireCommunityMigrationLease(db: Firestore, isolatedRestore = false): Promise<CommunityMigrationLease> {
  const id = randomUUID();
  await db.runTransaction(async transaction => {
    const [worker, maintenance] = await transaction.getAll(db.doc('_jobWorkerState/lease'), db.doc('_serviceState/maintenance'));
    const now = Date.now();
    if (worker.get('expiresAtMs') > now || (maintenance.get('active') === true && maintenance.get('expiresAtMs') > now)) throw new Error('A writer or maintenance operation is active.');
    transaction.set(worker.ref, { id, jobId: 'community-privacy', expiresAtMs: now + LIFETIME_MS });
    transaction.set(maintenance.ref, { id, active: true, operation: 'community-privacy', expiresAtMs: now + LIFETIME_MS });
  });
  return { id, isolatedRestore };
}

/** Caller performs ALL remaining reads before invoking the returned renewal. */
export async function prepareCommunityMigrationGuard(transaction: Transaction, db: Firestore, owners: string[], lease?: CommunityMigrationLease) {
  const uids = [...new Set(owners.filter(uid => uid !== '__deleted__'))];
  const refs = [db.doc('_jobWorkerState/lease'), db.doc('_serviceState/maintenance'),
    ...uids.map(uid => db.doc('_accountLocks/' + uid)), ...uids.map(uid => db.doc('_deletionJournal/' + uid))];
  const rows = await transaction.getAll(...refs), now = Date.now();
  if (lease) {
    if (rows[0].get('id') !== lease.id || rows[1].get('id') !== lease.id || rows[0].get('expiresAtMs') <= now
      || rows[1].get('active') !== true || rows[1].get('expiresAtMs') <= now) throw new Error('Community migration lease is no longer valid.');
  } else if (rows[0].get('expiresAtMs') > now || (rows[1].get('active') === true && rows[1].get('expiresAtMs') > now)) {
    throw new CommunityRecordConflict('active-maintenance');
  }
  for (let i = 0; i < uids.length; i++) {
    if (!lease?.isolatedRestore && rows[2 + i].exists) throw new CommunityRecordConflict('account-lock');
    if (rows[2 + uids.length + i].exists) throw new CommunityRecordConflict('deletion-journal');
  }
  return () => {
    if (!lease) return;
    if (Date.now() >= Math.min(rows[0].get('expiresAtMs'), rows[1].get('expiresAtMs'))) throw new Error('Community migration lease expired before commit.');
    const expiresAtMs = Date.now() + LIFETIME_MS;
    transaction.update(rows[0].ref, { expiresAtMs });
    transaction.update(rows[1].ref, { expiresAtMs });
  };
}

export async function releaseCommunityMigrationLease(db: Firestore, lease: CommunityMigrationLease) {
  await db.runTransaction(async transaction => {
    const [worker, maintenance] = await transaction.getAll(db.doc('_jobWorkerState/lease'), db.doc('_serviceState/maintenance'));
    if (worker.get('id') === lease.id) transaction.delete(worker.ref);
    if (maintenance.get('id') === lease.id) transaction.delete(maintenance.ref);
  });
}
