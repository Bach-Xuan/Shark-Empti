import 'server-only';
import { randomUUID } from 'node:crypto';
import { isDeepStrictEqual } from 'node:util';
import type { Auth } from 'firebase-admin/auth';
import { FieldPath, type DocumentData, type Firestore } from 'firebase-admin/firestore';
import { readDocumentPaths } from '../firestore-descendants';
import { isCommunityProjectionPath, isManagedCommunityProjection, rebuildRestoredCommunity } from '../community-privacy-migration';
import { projectArenaRanking, projectForumMetadata } from '../community-projections';
import { userBudgetPaths } from './catalog';
import { DELETION_CUTOVER, JOB_LIMITS } from './config';
import { retainedRecord } from './restored-record';

export const RESTORE_MARKER = '_serviceState/isolatedRestore';

export async function readErasedOwners(db: Firestore) {
  const result = new Set<string>();
  for (const root of ['_deletionJournal', '_accountLocks']) {
    let after: string | undefined;
    for (;;) {
      let query = db.collection(root).orderBy(FieldPath.documentId()).select().limit(100);
      if (after) query = query.startAfter(after);
      const page = await query.get();
      for (const doc of page.docs) result.add(doc.id);
      if (page.size < 100) break;
      after = page.docs.at(-1)!.id;
    }
  }
  return result;
}

/** The same fence is read by deletion admission inside its journal-creation transaction. */
export async function holdDeletionCutover(source: Firestore, jobId: string, target: string) {
  const ref = source.doc(DELETION_CUTOVER);
  return source.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (current.exists) {
      if (current.get('jobId') !== jobId || current.get('target') !== target || typeof current.get('token') !== 'string') throw new Error('A different restore holds source deletion admission.');
      return current.get('token') as string;
    }
    const token = randomUUID();
    tx.create(ref, { jobId, target, token, createdAtMs: Date.now() });
    return token;
  });
}

export async function releaseDeletionCutover(source: Firestore, jobId: string, target: string) {
  const ref = source.doc(DELETION_CUTOVER);
  await source.runTransaction(async tx => {
    const current = await tx.get(ref);
    if (!current.exists) return;
    if (current.get('jobId') !== jobId || current.get('target') !== target) throw new Error('Source fence belongs to another restore.');
    tx.delete(ref);
  });
}

async function verifyProjection(db: Firestore, path: string, actual: DocumentData) {
  const parts = path.split('/');
  const source = parts[0] === 'forumPosts'
    ? (await db.doc(['posts', ...parts.slice(1)].join('/')).get()).data()
    : (await db.collection('arenaExams/' + parts[1] + '/attempts').where('publicId', '==', parts[3]).limit(1).get()).docs[0]?.data();
  const expected = parts[0] === 'forumPosts' ? projectForumMetadata(source, parts.length === 2 ? 'post' : 'comment') : projectArenaRanking(source);
  if (!expected || !isDeepStrictEqual(expected, actual)) throw new Error('Public projection does not match the reconciled source. Keep the target isolated.');
}

async function reconcileDocuments(db: Firestore, auth: Auth, deleted: Set<string>, jobId: string, verify: boolean) {
  const budgets = new Set([...deleted].flatMap(userBudgetPaths));
  let after: string | undefined, changed = 0;
  for (;;) {
    const paths = await readDocumentPaths(auth, '', 100, after);
    if (!paths.length) break;
    const rows = await db.getAll(...paths.map(path => db.doc(path)));
    const batch = db.batch();
    let writes = 0;
    for (const row of rows) {
      const data = row.data(), path = row.ref.path;
      if (!data || ['_accountLocks', '_deletionJournal', '_serviceState'].includes(path.split('/')[0])) continue;
      if (isCommunityProjectionPath(path)) {
        if (!isManagedCommunityProjection(path, data)) throw new Error('Unknown data in a public projection namespace.');
        if (verify) await verifyProjection(db, path, data);
        continue;
      }
      const retained = retainedRecord(path, data, deleted, budgets, jobId);
      if (retained?.path === path && isDeepStrictEqual(data, retained.data)) continue;
      if (verify) throw new Error('Erased or inconsistent data remains on the restore target.');
      if (retained && retained.path !== path) batch.create(db.doc(retained.path), retained.data);
      if (retained?.path === path) batch.set(row.ref, retained.data);
      else batch.delete(row.ref);
      writes++;
    }
    if (writes) { await batch.commit(); changed += writes; }
    after = paths.at(-1);
    if (paths.length < 100) break;
  }
  return changed;
}

export async function finalizeRestoredDeletions(source: Firestore, db: Firestore, auth: Auth, jobId: string, sourceProject: string) {
  const target = auth.app.options.projectId;
  if (!target || target === sourceProject || db === source) throw new Error('Restore verification requires a distinct target.');
  const marker = db.doc(RESTORE_MARKER), bound = await marker.get();
  if (bound.get('jobId') !== jobId || bound.get('sourceProject') !== sourceProject) throw new Error('Target has no matching completed initial restore.');
  const token = await holdDeletionCutover(source, jobId, target);
  await marker.update({ phase: 'reconciling' });
  const deleted = new Set([...await readErasedOwners(source), ...await readErasedOwners(db)]);
  const owners = [...deleted];
  for (let i = 0; i < owners.length; i += 100) {
    const ids = owners.slice(i, i + 100);
    const present = await auth.getUsers(ids.map(uid => ({ uid })));
    if (present.users.length && (await auth.deleteUsers(present.users.map(user => user.uid))).failureCount) throw new Error('Target Auth erasure failed.');
    const batch = db.batch(), now = Date.now();
    for (const uid of ids) {
      batch.set(db.collection('_accountLocks').doc(uid), { status: 'deleted', expiresAt: new Date(now + JOB_LIMITS.backupLifetimeMs) });
      batch.set(db.collection('_deletionJournal').doc(uid), { uid, restoredDeletion: true, expiresAt: new Date(now + JOB_LIMITS.journalLifetimeMs) });
    }
    await batch.commit();
  }
  const changed = await reconcileDocuments(db, auth, deleted, jobId, false);
  const community = await rebuildRestoredCommunity(db);
  if (community.blocked) throw new Error('Community reconstruction requires review.');
  await reconcileDocuments(db, auth, deleted, jobId, true);
  for (let i = 0; i < owners.length; i += 100) {
    if ((await auth.getUsers(owners.slice(i, i + 100).map(uid => ({ uid })))).users.length) throw new Error('Erased Auth identity remains on target.');
  }
  if ((await source.doc(DELETION_CUTOVER).get()).get('token') !== token) throw new Error('Source deletion admission reopened during reconciliation.');
  await marker.update({ phase: 'verified', verifiedAtMs: Date.now(), fenceToken: token });
  return { appliedDeletions: owners.length, changed, verified: true };
}
