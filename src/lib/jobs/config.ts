import 'server-only';
import { ApiError } from '../server-api';

export const JOB_LIMITS = {
  pageSize: 10, partBytes: 2_000_000, objectBytes: 10_000_000,
  leaseMs: 60_000, stepMs: 20_000, stepsPerInvocation: 2, exportLifetimeMs: 24 * 60 * 60 * 1000,
  exportProcessingMs: 7 * 24 * 60 * 60 * 1000,
  backupLifetimeMs: 7 * 24 * 60 * 60 * 1000, journalLifetimeMs: 30 * 24 * 60 * 60 * 1000,
  retries: 3, maintenanceDeletes: 100,
} as const;

export function jobsEnvironment(): 'production' | 'staging' | 'test' {
  const value = process.env.JOB_ENVIRONMENT;
  if (value === 'production' || value === 'staging') return value;
  if (value === 'test' && emulatorJobs()) return value;
  throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Account jobs are not configured.');
}
export function emulatorJobs() {
  return process.env.SHARK_EMULATOR_TEST_MODE === 'true'
    && process.env.GCLOUD_PROJECT?.startsWith('demo-')
    && /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST ?? '')
    && /^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIREBASE_AUTH_EMULATOR_HOST ?? '');
}
export function jobSecret(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Account jobs are not configured.');
  return value;
}
export function jobsConfigured() {
  try { requireJobs(); return true; } catch { return false; }
}
export function requireRetention() {
  if (process.env.RETENTION_ENABLED !== 'true' && process.env.ACCOUNT_JOBS_ENABLED !== 'true') throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Retention is not configured.');
  return requireQueue();
}
function requireQueue() {
  const environment = jobsEnvironment();
  for (const name of ['QSTASH_TOKEN', 'QSTASH_CURRENT_SIGNING_KEY', 'QSTASH_NEXT_SIGNING_KEY']) jobSecret(name);
  const origin = new URL(jobSecret('JOBS_BASE_URL'));
  if (origin.username || origin.password || origin.pathname !== '/' || origin.search || origin.hash
    || (origin.protocol !== 'https:' && !(emulatorJobs() && origin.origin === 'http://127.0.0.1:9002'))) {
    throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Retention is not configured.');
  }
  return { environment, workerUrl: new URL('/api/internal/jobs', origin).href };
}
export function requireJobs() {
  if (process.env.ACCOUNT_JOBS_ENABLED !== 'true') throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Account jobs are temporarily unavailable.');
  const queue = requireQueue();
  for (const name of ['B2_KEY_ID', 'B2_APPLICATION_KEY', 'B2_BUCKET_ID', 'JOB_ENCRYPTION_KEY']) jobSecret(name);
  if (Buffer.from(jobSecret('JOB_ENCRYPTION_KEY'), 'base64').length !== 32) throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Account jobs are not configured.');
  return { ...queue,
    deliveryBudget: queue.environment === 'production' ? 500 : 100,
    storageBytes: queue.environment === 'production' ? 7_000_000_000 : 1_000_000_000 };
}
export function fixtureOrigin() {
  const value = process.env.JOB_TRANSPORT_TEST_URL;
  if (!value) return null;
  if (!emulatorJobs() || value !== 'http://127.0.0.1:9097') throw new ApiError('ACCOUNT-JOBS-UNAVAILABLE', 503, 'Job transport is not configured.');
  return value;
}
