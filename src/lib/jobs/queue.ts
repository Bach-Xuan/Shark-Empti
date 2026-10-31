import 'server-only';
import { Client, Receiver, QstashError } from '@upstash/qstash';
import { getAdminDb } from '../firebase-admin';
import { ApiError } from '../server-api';
import { fixtureOrigin, jobSecret, JOB_LIMITS, requireJobs, requireRetention } from './config';
import type { JobMessage } from './types';

export async function verifyJobSignature(body: string, signature: string | null) {
  const config = requireRetention();
  if (!signature) throw new ApiError('AUTH-FORBIDDEN', 403, 'Job authorization is required.');
  try {
    const valid = await new Receiver({ currentSigningKey: jobSecret('QSTASH_CURRENT_SIGNING_KEY'), nextSigningKey: jobSecret('QSTASH_NEXT_SIGNING_KEY') })
      .verify({ body, signature, url: config.workerUrl });
    if (!valid) throw new Error('Invalid signature');
  } catch { throw new ApiError('AUTH-FORBIDDEN', 403, 'Job authorization is invalid.'); }
}

/** Reserve all possible deliveries before publish; ambiguous failures keep credit spent. */
export async function enqueueJob(jobId: string): Promise<boolean> {
  const config = requireJobs();
  const db = getAdminDb();
  const now = Date.now();
  const day = new Date(now).toISOString().slice(0, 10);
  const budgetRef = db.collection('_jobBudgets').doc(config.environment + '_' + day);
  const jobRef = db.collection('_accountJobs').doc(jobId);
  const admitted = await db.runTransaction(async transaction => {
    const [budget, job] = await Promise.all([transaction.get(budgetRef), transaction.get(jobRef)]);
    if (!job.exists || !['queued', 'waiting_quota'].includes(job.get('status')) || job.get('nextRunAtMs') > now) return false;
    const reserved = budget.get('reserved') ?? 0;
    if (!Number.isSafeInteger(reserved) || reserved + JOB_LIMITS.retries + 1 > config.deliveryBudget) {
      const tomorrow = Date.parse(day + 'T00:00:00Z') + 86_400_000;
      transaction.update(jobRef, { status: 'waiting_quota', nextRunAtMs: tomorrow, updatedAtMs: now, errorCode: 'ACCOUNT-JOBS-QUOTA' });
      return false;
    }
    transaction.set(budgetRef, { reserved: reserved + JOB_LIMITS.retries + 1, expiresAt: new Date(now + JOB_LIMITS.backupLifetimeMs) });
    transaction.update(jobRef, { nextRunAtMs: now + JOB_LIMITS.leaseMs });
    return true;
  });
  if (!admitted) return false;
  const message: JobMessage = { jobId, environment: config.environment };
  try {
    const client = new Client({ token: jobSecret('QSTASH_TOKEN'), retry: false,
      ...(fixtureOrigin() ? { baseUrl: fixtureOrigin() + '/qstash' } : {}), enableTelemetry: false });
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        client.publishJSON({ url: config.workerUrl, body: message, retries: JOB_LIMITS.retries, timeout: '25s', deduplicationId: jobId + ':' + now }),
        new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('Queue publish deadline')), 5_000); }),
      ]);
    } finally { clearTimeout(timer); }
    return true;
  } catch (error) {
    if (error instanceof QstashError && error.status === 429) await db.runTransaction(async transaction => {
      const current = await transaction.get(jobRef);
      if (['queued', 'waiting_quota'].includes(current.get('status')) && (current.get('lease.expiresAtMs') ?? 0) <= Date.now()) {
        transaction.update(jobRef, { status: 'waiting_quota', nextRunAtMs: Date.now() + 3_600_000, updatedAtMs: Date.now(), errorCode: 'ACCOUNT-JOBS-QUOTA' });
      }
    });
    // Durable Firestore state remains discoverable by the signed hourly sweep.
    return false;
  }
}
