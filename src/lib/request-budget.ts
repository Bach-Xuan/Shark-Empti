import 'server-only';
import { createHash } from 'node:crypto';
import { Timestamp, type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from './firebase-admin';
import { ApiError, assertWritable } from './server-api';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
/** Provisional operational ceilings, not a claim of calibrated production capacity. */
export const REQUEST_BUDGETS = {
  'ai-traffic': { user: 180, global: 1800, window: MINUTE, userBytes: 0, globalBytes: 0 },
  'ai-create': { user: 30, global: 300, window: 15 * MINUTE, userBytes: 512_000, globalBytes: 5_120_000 },
  'learning-traffic': { user: 180, global: 1800, window: MINUTE, userBytes: 0, globalBytes: 0 },
  'learning-write': { user: 120, global: 1200, window: HOUR, userBytes: 24_000_000, globalBytes: 240_000_000 },
  'community-traffic': { user: 180, global: 1800, window: MINUTE, userBytes: 0, globalBytes: 0 },
  'moderation-traffic': { user: 30, global: 300, window: MINUTE, userBytes: 0, globalBytes: 0 },
  'post-create': { user: 10, global: 100, window: HOUR, userBytes: 500_000, globalBytes: 5_000_000 },
  'comment-create': { user: 60, global: 600, window: HOUR, userBytes: 120_000, globalBytes: 1_200_000 },
  'arena-create': { user: 5, global: 50, window: HOUR, userBytes: 1_000_000, globalBytes: 10_000_000 },
  'arena-start': { user: 30, global: 300, window: HOUR, userBytes: 0, globalBytes: 0 },
  'arena-submit': { user: 60, global: 600, window: HOUR, userBytes: 0, globalBytes: 0 },
  'community-report': { user: 10, global: 1000, window: HOUR, userBytes: 0, globalBytes: 0 },
  'community-mutate': { user: 120, global: 1200, window: HOUR, userBytes: 500_000, globalBytes: 5_000_000 },
  'account-traffic': { user: 60, global: 600, window: MINUTE, userBytes: 0, globalBytes: 0 },
  'account-export': { user: 240, global: 2400, window: 24 * HOUR, userBytes: 0, globalBytes: 0 },
  'account-request': { user: 3, global: 30, window: 24 * HOUR, userBytes: 0, globalBytes: 0 },
} as const;
export type BudgetScope = keyof typeof REQUEST_BUDGETS;

type Bucket = { tokens?: number; bytes?: number; updatedAtMs?: number };
type BudgetPolicy = { user: number; global: number; window: number; userBytes: number; globalBytes: number };

/** Pure admission primitive; authorization is enforced by each public wrapper. */
async function prepareBuckets(transaction: Transaction, scope: string, subject: string | null, policy: BudgetPolicy, bytes: number, now: number) {
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid budget cost.');
  const limits = [
    ...(subject ? [{ id: `${scope}_${subject}`, count: policy.user, bytes: policy.userBytes }] : []),
    { id: `${scope}_global`, count: policy.global, bytes: policy.globalBytes },
  ];
  const refs = limits.map(limit => getAdminDb().collection('_requestBudgets').doc(limit.id));
  const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
  const plans = snapshots.map((snapshot, index) => {
    const current = snapshot.data() as Bucket | undefined;
    const capacity = limits[index].count;
    const byteCapacity = limits[index].bytes;
    const elapsed = Math.max(0, now - (current?.updatedAtMs ?? now));
    const refill = (value: number | undefined, maximum: number) => Math.min(maximum,
      (value === undefined && !snapshot.exists ? maximum : Number.isFinite(value) ? Math.max(0, value!) : 0) + elapsed * maximum / policy.window);
    const tokens = refill(current?.tokens, capacity);
    const remainingBytes = byteCapacity ? refill(current?.bytes, byteCapacity) : 0;
    if (tokens < 1 || (byteCapacity && remainingBytes < bytes)) {
      throw new ApiError('APP-RATE-LIMITED', 429, 'Too many requests. Please try again later.');
    }
    return { tokens: tokens - 1, bytes: byteCapacity ? remainingBytes - bytes : 0, updatedAtMs: Math.max(now, current?.updatedAtMs ?? now), expiresAt: Timestamp.fromMillis(now + policy.window * 2) };
  });
  return () => refs.forEach((ref, index) => transaction.set(ref, plans[index]));
}

/** Read first, commit last: callers can finish all business reads before any write. */
export async function prepareRequestBudget(transaction: Transaction, uid: string, scope: BudgetScope, bytes = 0, now = Date.now(), access: { allowLocked?: boolean; allowMaintenance?: boolean } = {}) {
  // Data-rights and consent controls remain available before policy acceptance.
  await assertWritable(transaction, uid, { ...access, allowUnconsented: scope.startsWith('account-') });
  const owner = createHash('sha256').update(uid).digest('hex');
  return prepareBuckets(transaction, scope, 'user_' + owner, REQUEST_BUDGETS[scope], bytes, now);
}

export async function enforceRequestBudget(uid: string, scope: BudgetScope, access: { allowLocked?: boolean; allowMaintenance?: boolean } = {}) {
  return getAdminDb().runTransaction(async transaction => {
    const commit = await prepareRequestBudget(transaction, uid, scope, 0, Date.now(), access);
    commit();
  });
}

/** Receipt possession survives Auth deletion; admit before any private-job lookup.
 * Use a global ceiling without persisting receipt identifiers or trusting an IP
 * header. Public status admission has no UID/account-write precondition. */
export async function enforceReceiptRequestBudget(receipt: string) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(receipt)) throw new ApiError('APP-NOT-FOUND', 404, 'Job not found.');
  return getAdminDb().runTransaction(async transaction => {
    const commit = await prepareBuckets(transaction, 'account-receipt', null, REQUEST_BUDGETS['account-traffic'], 0, Date.now());
    commit();
  });
}
