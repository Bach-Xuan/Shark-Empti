import 'server-only';
import { getAdminAuth, getAdminDb } from '../firebase-admin';
import { exportValue } from '../export-value';
import { ApiError } from '../server-api';
import { digest } from './crypto';
import { JOB_LIMITS } from './config';
import { inventoryPage } from './inventory';
import { assertJobLease } from './store';
import { PrivateJobStorage } from './storage';
import type { JobRecord, StepResult } from './types';

const WINDOW_MS = 5 * 60_000;
const EXCLUDED_CONTROL_COLLECTIONS = new Set(['_jobWorkerState', '_serviceState']);
async function part(id: string, job: JobRecord, data: unknown, records: number) {
  const bytes = Buffer.from(JSON.stringify(data));
  return new PrivateJobStorage().put('backups/' + id + '/' + digest(bytes) + '.enc', bytes, records, job.expiresAtMs);
}
export async function backupStep(id: string, job: JobRecord): Promise<StepResult> {
  const db = getAdminDb(), maintenance = db.collection('_serviceState').doc('maintenance');
  if (job.cursor.phase === 0) {
    await db.runTransaction(async transaction => {
      await assertJobLease(transaction, id, job);
      const previous = await transaction.get(maintenance);
      const sameWindow = previous.get('jobId') === id;
      if (sameWindow && previous.get('expiresAtMs') <= Date.now()) throw new ApiError('APP-DATA-INVALID', 409, 'The consistent backup window expired.');
      transaction.set(maintenance, { active: true, jobId: id, expiresAtMs: sameWindow ? previous.get('expiresAtMs') : Date.now() + WINDOW_MS });
    });
    const collections = (await db.listCollections()).map(collection => collection.path).filter(name => !EXCLUDED_CONTROL_COLLECTIONS.has(name));
    return { cursor: { phase: 1, collections, collectionIndex: 0 }, processed: 0 };
  }
  const state = await maintenance.get();
  if (state.get('jobId') !== id || state.get('expiresAtMs') <= Date.now()) throw new ApiError('APP-DATA-INVALID', 409, 'The consistent backup window expired.');
  if (job.cursor.phase === 1) {
    const collections = [...job.cursor.collections!], index = job.cursor.collectionIndex!;
    if (index >= collections.length) return { cursor: { phase: 2 }, processed: 0 };
    const inventory = job.cursor.pending?.length ? { paths: job.cursor.pending, after: job.cursor.after } : await inventoryPage(collections[index], job.cursor.after, 100);
    const snapshots = inventory.paths.length ? await db.getAll(...inventory.paths.map(path => db.doc(path))) : [];
    const documents = [];
    let bytes = 0, consumed = 0;
    for (const document of snapshots) {
      if (document.ref.path === '_accountJobs/' + id) { consumed++; continue; }
      if (document.exists) {
        const item = { path: document.ref.path, data: exportValue(document.data()) };
        const length = Buffer.byteLength(JSON.stringify(item));
        if (bytes + length > JOB_LIMITS.partBytes && consumed) break;
        if (bytes + length > JOB_LIMITS.objectBytes - 1000) throw new ApiError('APP-EXPORT-LIMIT', 413, 'A backup record exceeds its bounded capacity.');
        documents.push(item); bytes += length;
      }
      consumed++;
      for (const child of await document.ref.listCollections()) if (!collections.includes(child.path)) collections.push(child.path);
    }
    if (collections.length > 2000) throw new ApiError('APP-EXPORT-LIMIT', 413, 'Backup inventory exceeds its bounded capacity.');
    const pending = inventory.paths.slice(consumed);
    return { cursor: pending.length || inventory.after ? { phase: 1, collections, collectionIndex: index,
      ...(inventory.after ? { after: inventory.after } : {}), ...(pending.length ? { pending } : {}) } : { phase: 1, collections, collectionIndex: index + 1 },
      processed: documents.length, ...(documents.length ? { artifact: await part(id, job, { kind: 'firestore', documents }, documents.length) } : {}) };
  }
  if (job.cursor.phase === 2) {
    const result = await getAdminAuth().listUsers(100, job.cursor.after);
    if (result.users.some(user => user.providerData.some(provider => provider.providerId !== 'google.com'))) throw new ApiError('APP-DATA-INVALID', 409, 'A backup strategy for this identity provider is required.');
    // exportUsers password hashes/salts are intentionally never requested or stored.
    const users = result.users.map(user => ({ uid: user.uid, email: user.email ?? null, emailVerified: user.emailVerified, displayName: user.displayName ?? null,
      photoURL: user.photoURL ?? null, disabled: user.disabled, customClaims: user.customClaims ?? {}, providers: user.providerData.map(provider => provider.toJSON()), metadata: user.metadata.toJSON() }));
    return { cursor: result.pageToken ? { phase: 2, after: result.pageToken } : { phase: 3 }, processed: users.length,
      ...(users.length ? { artifact: await part(id, job, { kind: 'auth', users }, users.length) } : {}) };
  }
  const artifact = await part(id, job, { format: 'shark-backup-v1', records: job.processed, environment: job.environment,
    writeWindowStartedAtMs: state.get('expiresAtMs') - WINDOW_MS, artifacts: job.artifacts,
    exclusions: [...EXCLUDED_CONTROL_COLLECTIONS], auth: 'Google federated identities and claims; no password credentials',
    restore: 'Isolated project only; apply the current deletion journal before enabling access.' }, 0);
  // finishStep releases the barrier atomically with the durable completion checkpoint.
  return { cursor: { phase: 4 }, processed: 0, artifact, complete: true };
}
