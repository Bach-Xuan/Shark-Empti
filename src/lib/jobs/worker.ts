import 'server-only';
import { randomUUID } from 'node:crypto';
import { FieldValue, type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from '../firebase-admin';
import { ApiError } from '../server-api';
import { claimJob, finishStep, jobIdFor } from './store';
import { exportStep, deletionStep } from './account-worker';
import { backupStep } from './backup';
import { JOB_LIMITS, requireRetention, jobsConfigured } from './config';
import { enqueueJob } from './queue';
import { PrivateJobStorage } from './storage';
import { readJob } from './types';

async function runStep(id: string): Promise<boolean> {
  const job = await claimJob(id);
  if (!job) return false;
  try {
    if (job.kind === 'export' && (await getAdminDb().collection('_accountLocks').doc(job.ownerUid!).get()).exists) {
      await finishStep(id, job, { cursor: job.cursor, processed: 0 }, 'APP-DATA-INVALID'); return false;
    }
    const result = job.kind === 'export' ? await exportStep(id, job) : job.kind === 'deletion' ? await deletionStep(id, job) : await backupStep(id, job);
    await finishStep(id, job, result);
    return !result.complete;
  } catch (error) {
    if (error instanceof ApiError && error.code === 'ACCOUNT-JOB-LEASE') return false;
    const code = error instanceof ApiError ? error.code : 'ACCOUNT-JOB-RETRY';
    await finishStep(id, job, { cursor: job.cursor, processed: 0 }, code);
    console.warn(JSON.stringify({ event: 'account-job-step', jobId: id, environment: job.environment, code }));
    return false;
  }
}

export async function runJob(id: string) {
  const started = Date.now();
  for (let step = 0; step < JOB_LIMITS.stepsPerInvocation; step++) {
    if (!await runStep(id)) return;
    if (Date.now() - started >= JOB_LIMITS.stepMs) break;
  }
  await enqueueJob(id);
}

const workerLeaseRef = () => getAdminDb().collection('_jobWorkerState').doc('lease');
async function maintenanceTransaction<T>(leaseId: string, operation: (transaction: Transaction) => Promise<T> | T) {
  return getAdminDb().runTransaction(async transaction => {
    const lease = await transaction.get(workerLeaseRef());
    if (lease.get('id') !== leaseId || lease.get('expiresAtMs') <= Date.now()) throw new ApiError('ACCOUNT-JOB-LEASE', 409, 'The maintenance lease expired.');
    return operation(transaction);
  });
}
async function cleanExpiredRecords(leaseId: string, now: number) {
  const db = getAdminDb();
  const collections = ['_aiGenerations', '_arenaSessions', '_requestReceipts', '_requestBudgets', '_aiQuota', '_accountRequests', '_accountLocks', '_jobBudgets'];
  const progressRef = db.collection('_serviceState').doc('retention');
  const previousProgress = await progressRef.get();
  const progress = previousProgress.get('collectionIndex');
  const start = Number.isSafeInteger(progress) && progress >= 0 ? progress % collections.length : 0;
  const kinds = ['export', 'backup', 'deletion'] as const;
  const previousKind = previousProgress.get('jobKindIndex');
  const kindStart = Number.isSafeInteger(previousKind) && previousKind >= 0 ? previousKind % kinds.length : 0;
  let removed = 0, inspected = 0;
  for (let offset = 0; offset < collections.length && inspected < JOB_LIMITS.maintenanceDeletes; offset++) {
    const name = collections[(start + offset) % collections.length];
    const expired = await db.collection(name).where('expiresAt', '<=', new Date(now)).limit(JOB_LIMITS.maintenanceDeletes - inspected).get();
    if (expired.size) removed += await maintenanceTransaction(leaseId, async transaction => {
      const current = await Promise.all(expired.docs.map(document => transaction.get(document.ref)));
      let deleted = 0;
      for (const document of current) {
        const expiry = document.get('expiresAt');
        if (document.exists && typeof expiry?.toMillis === 'function' && expiry.toMillis() <= now) { transaction.delete(document.ref); deleted++; }
      }
      return deleted;
    });
    inspected += expired.size;
  }
  await maintenanceTransaction(leaseId, transaction => { transaction.set(progressRef, {
    collectionIndex: (start + 1) % collections.length, jobKindIndex: (kindStart + 1) % kinds.length,
  }, { merge: true }); });
  const journals = await db.collection('_deletionJournal').where('expiresAt', '<=', new Date(now)).limit(10).get();
  for (const journal of journals.docs) await maintenanceTransaction(leaseId, async transaction => {
    const lock = await transaction.get(db.collection('_accountLocks').doc(journal.id));
    if (!lock.exists) transaction.delete(journal.ref);
  });
  if (!jobsConfigured()) return removed;
  // Retain a visible failure after a bounded processing window instead of silently
  // erasing a quota-delayed export. Deletion locks/jobs never expire this way.
  const pending = await db.collection('_accountJobs').where('kind', '==', 'export')
    .where('status', 'in', ['queued', 'running', 'waiting_quota']).where('expiresAtMs', '<=', now).orderBy('expiresAtMs').limit(20).get();
  for (const snapshot of pending.docs) await maintenanceTransaction(leaseId, async transaction => {
    const current = await transaction.get(snapshot.ref);
    if (!current.exists || !['queued', 'running', 'waiting_quota'].includes(current.get('status'))
      || current.get('expiresAtMs') > now || current.get('lease.expiresAtMs') > now) return;
    transaction.update(snapshot.ref, { status: 'failed', errorCode: 'ACCOUNT-JOB-EXPIRED', lease: FieldValue.delete(),
      updatedAtMs: now, expiresAtMs: now + JOB_LIMITS.exportLifetimeMs, expiresAt: new Date(now + JOB_LIMITS.exportLifetimeMs) });
  });
  // Query terminal states only, and rotate kinds so pending deletion locks and a
  // large export cannot starve unrelated receipts/backups. Part cleanup resumes.
  let objectBudget = 20;
  let jobBudget = 20;
  const storage = new PrivateJobStorage();
  for (let offset = 0; offset < kinds.length && jobBudget && objectBudget; offset++) {
    const kind = kinds[(kindStart + offset) % kinds.length];
    const statuses = kind === 'export' ? ['ready', 'failed'] : kind === 'backup' ? ['completed', 'failed'] : ['completed'];
    const expiredJobs = await db.collection('_accountJobs').where('kind', '==', kind).where('status', 'in', statuses)
      .where('expiresAtMs', '<=', now).orderBy('expiresAtMs').limit(jobBudget).get();
    jobBudget -= expiredJobs.size;
    for (const snapshot of expiredJobs.docs) {
      const job = readJob(snapshot.data());
      if ((job.lease?.expiresAtMs ?? 0) > now) continue;
      const selected = job.artifacts.slice(0, objectBudget);
      for (const artifact of selected) await storage.remove({ fileId: artifact.fileId, fileName: artifact.name });
      objectBudget -= selected.length;
      await maintenanceTransaction(leaseId, transaction => {
        if (selected.length < job.artifacts.length) transaction.update(snapshot.ref, { artifacts: job.artifacts.slice(selected.length) });
        else transaction.delete(snapshot.ref);
      });
      if (!objectBudget) break;
    }
  }
  await storage.removeExpired();
  return removed;
}

async function dispatchDue(now: number) {
  const db = getAdminDb();
  const due = await db.collection('_accountJobs').where('status', 'in', ['queued', 'waiting_quota', 'running']).where('nextRunAtMs', '<=', now).orderBy('nextRunAtMs').limit(5).get();
  for (const document of due.docs) {
    if (document.get('status') === 'running') await db.runTransaction(async transaction => {
      const current = await transaction.get(document.ref);
      if (current.get('status') === 'running' && current.get('lease.expiresAtMs') <= Date.now()) {
        transaction.update(document.ref, { status: 'queued', lease: FieldValue.delete(), nextRunAtMs: now });
      }
    });
    await enqueueJob(document.id);
  }
}

/** Signed hourly scheduler; cleanup and business jobs share one fenced worker. */
export async function maintenanceSweep() {
  const config = requireRetention(), db = getAdminDb(), now = Date.now();
  const maintenance = await db.collection('_serviceState').doc('maintenance').get();
  if (maintenance.get('active') === true && maintenance.get('expiresAtMs') > now) {
    if (jobsConfigured() && typeof maintenance.get('jobId') === 'string') await enqueueJob(maintenance.get('jobId'));
    return { removed: 0 };
  }
  const leaseId = randomUUID();
  const admitted = await db.runTransaction(async transaction => {
    const lease = await transaction.get(workerLeaseRef());
    if (lease.get('expiresAtMs') > now) return false;
    transaction.set(workerLeaseRef(), { id: leaseId, jobId: 'maintenance', expiresAtMs: now + JOB_LIMITS.leaseMs });
    return true;
  });
  if (!admitted) return { removed: 0 };
  let removed = 0;
  try {
    removed = await cleanExpiredRecords(leaseId, now);
    if (jobsConfigured() && process.env.ACCOUNT_BACKUPS_ENABLED === 'true') {
      const id = jobIdFor('backup:' + config.environment + ':' + new Date(now).toISOString().slice(0, 10));
      await maintenanceTransaction(leaseId, async transaction => {
        const ref = db.collection('_accountJobs').doc(id), snapshot = await transaction.get(ref);
        if (!snapshot.exists) transaction.create(ref, { kind: 'backup', status: 'queued', environment: config.environment, cursor: { phase: 0 }, artifacts: [], processed: 0,
          createdAtMs: now, updatedAtMs: now, expiresAtMs: now + JOB_LIMITS.backupLifetimeMs, expiresAt: new Date(now + JOB_LIMITS.backupLifetimeMs), nextRunAtMs: now });
      });
    }
  } catch {
    // Storage/cleanup failure must not prevent independent deletion work resuming.
    console.warn(JSON.stringify({ event: 'account-maintenance', environment: config.environment, code: 'ACCOUNT-MAINTENANCE-RETRY' }));
  } finally {
    await db.runTransaction(async transaction => {
      const lease = await transaction.get(workerLeaseRef());
      if (lease.get('id') === leaseId) transaction.delete(workerLeaseRef());
    });
  }
  // Publish after releasing the lease so an immediate delivery can claim its job.
  if (jobsConfigured()) await dispatchDue(now);
  return { removed };
}
