import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin';
import { ApiError, assertWritable } from '../server-api';
import { requireJobs, JOB_LIMITS } from './config';
import { digest, receiptFor } from './crypto';
import { readJob, type JobRecord, type StepResult } from './types';
import { prepareRequestBudget } from '../request-budget';

export function jobIdFor(value: string) {
  const bytes = Buffer.from(digest(value).slice(0, 32), 'hex');
  bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
  const hex = bytes.toString('hex');
  return [hex.slice(0, 8), hex.slice(8, 12), hex.slice(12, 16), hex.slice(16, 20), hex.slice(20)].join('-');
}
export async function createAccountJob(uid: string, kind: 'export' | 'deletion', requestId: string) {
  const config = requireJobs(), db = getAdminDb();
  const id = jobIdFor(JSON.stringify([uid, requestId]));
  const ref = db.collection('_accountJobs').doc(id);
  const now = Date.now();
  const receipt = kind === 'deletion' ? receiptFor(id, uid) : undefined;
  const job = await db.runTransaction(async transaction => {
    const previous = await transaction.get(ref);
    if (previous.exists) {
      const old = readJob(previous.data());
      if (old.ownerUid !== uid || old.kind !== kind) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'The request identifier has already been used.');
      return old;
    }
    await assertWritable(transaction, uid);
    const commitBudget = await prepareRequestBudget(transaction, uid, 'account-request');
    const record: JobRecord = { kind, ownerUid: uid, environment: config.environment, status: 'queued', cursor: { phase: 0 }, artifacts: [], processed: 0,
      createdAtMs: now, updatedAtMs: now, expiresAtMs: now + (kind === 'export' ? JOB_LIMITS.exportProcessingMs : JOB_LIMITS.backupLifetimeMs), nextRunAtMs: now,
      ...(receipt ? { receiptHash: digest(receipt) } : {}) };
    commitBudget();
    transaction.create(ref, { ...record, expiresAt: new Date(record.expiresAtMs) });
    if (kind === 'deletion') {
      transaction.create(db.collection('_accountLocks').doc(uid), { status: 'deleting', jobId: id, createdAtMs: now });
      // Journal survives job completion so a later restore cannot resurrect this UID.
      transaction.set(db.collection('_deletionJournal').doc(uid), { uid, jobId: id, createdAtMs: now, expiresAt: new Date(now + JOB_LIMITS.journalLifetimeMs) });
    }
    return record;
  });
  return { id, job, receipt };
}

export async function assertJobLease(transaction: Transaction, id: string, job: JobRecord) {
  const [current, global] = await Promise.all([transaction.get(getAdminDb().collection('_accountJobs').doc(id)), transaction.get(getAdminDb().collection('_jobWorkerState').doc('lease'))]);
  if (!job.lease || current.get('lease.id') !== job.lease.id || global.get('id') !== job.lease.id || current.get('lease.expiresAtMs') <= Date.now()) throw new ApiError('ACCOUNT-JOB-LEASE', 409, 'The job lease has expired.');
}
export async function claimJob(id: string) {
  const db = getAdminDb(), now = Date.now(), leaseId = randomUUID();
  const ref = db.collection('_accountJobs').doc(id), globalRef = db.collection('_jobWorkerState').doc('lease');
  return db.runTransaction(async transaction => {
    const [snapshot, global, maintenance] = await Promise.all([transaction.get(ref), transaction.get(globalRef), transaction.get(db.collection('_serviceState').doc('maintenance'))]);
    if (!snapshot.exists) return null;
    const job = readJob(snapshot.data());
    if (job.environment !== requireJobs().environment || ['ready', 'completed', 'failed'].includes(job.status) || (job.kind !== 'deletion' && job.expiresAtMs <= now)
      || (maintenance.get('active') === true && maintenance.get('expiresAtMs') > now && maintenance.get('jobId') !== id)
      || (job.status === 'waiting_quota' && job.nextRunAtMs > now) || (job.lease?.expiresAtMs ?? 0) > now || global.get('expiresAtMs') > now) return null;
    const lease = { id: leaseId, expiresAtMs: now + JOB_LIMITS.leaseMs };
    transaction.set(globalRef, { ...lease, jobId: id });
    transaction.update(ref, { lease, status: 'running', updatedAtMs: now, nextRunAtMs: lease.expiresAtMs });
    return { ...job, status: 'running' as const, lease };
  });
}
export async function finishStep(id: string, job: JobRecord, result: StepResult, error?: string) {
  const db = getAdminDb(), ref = db.collection('_accountJobs').doc(id);
  await db.runTransaction(async transaction => {
    await assertJobLease(transaction, id, job);
    const now = Date.now();
    const failure = job.kind === 'export' && job.createdAtMs + JOB_LIMITS.exportProcessingMs <= now
      ? 'ACCOUNT-JOB-EXPIRED' : error;
    const completed = result.complete === true && !failure;
    const maintenance = db.collection('_serviceState').doc('maintenance');
    if (completed && job.kind === 'backup') {
      const state = await transaction.get(maintenance);
      if (state.get('jobId') !== id || state.get('active') !== true || state.get('expiresAtMs') <= Date.now()) {
        throw new ApiError('APP-DATA-INVALID', 409, 'The consistent backup window expired.');
      }
    }
    const quota = failure === 'ACCOUNT-STORAGE-QUOTA' || failure === 'ACCOUNT-JOBS-QUOTA';
    const terminal = ['APP-EXPORT-LIMIT', 'APP-DATA-INVALID', 'APP-REQUEST-CONFLICT', 'APP-INVALID-INPUT', 'ACCOUNT-JOB-EXPIRED'].includes(failure ?? '');
    const status = failure ? quota ? 'waiting_quota' : terminal ? 'failed' : 'queued' : completed ? job.kind === 'export' ? 'ready' : 'completed' : 'queued';
    const expiresAtMs = completed && job.kind === 'deletion' ? now + JOB_LIMITS.backupLifetimeMs
      : job.kind === 'export' && (completed || terminal) ? now + JOB_LIMITS.exportLifetimeMs : undefined;
    transaction.update(ref, { cursor: result.cursor, processed: job.processed + result.processed,
      artifacts: result.artifact ? [...job.artifacts, result.artifact] : job.artifacts, status,
      updatedAtMs: now, nextRunAtMs: failure ? now + (quota ? 3_600_000 : 60_000) : now,
      lease: FieldValue.delete(), errorCode: failure ?? FieldValue.delete(),
      ...(expiresAtMs ? { expiresAtMs, expiresAt: new Date(expiresAtMs) } : {}),
      ...(completed && job.kind === 'deletion' ? { ownerUid: FieldValue.delete() } : {}) });
    transaction.delete(db.collection('_jobWorkerState').doc('lease'));
    if (completed && job.kind === 'backup') transaction.update(maintenance, { active: false, jobId: FieldValue.delete() });
    if (completed && job.kind === 'deletion') {
      transaction.set(db.collection('_accountLocks').doc(job.ownerUid!), { status: 'deleted', expiresAt: new Date(now + JOB_LIMITS.backupLifetimeMs) });
      transaction.update(db.collection('_deletionJournal').doc(job.ownerUid!), { expiresAt: new Date(now + JOB_LIMITS.journalLifetimeMs) });
    }
  });
}
