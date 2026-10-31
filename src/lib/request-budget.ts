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

/** Read first, commit last: callers can finish all business reads before any write. */
export async function prepareRequestBudget(transaction: Transaction, uid: string, scope: BudgetScope, bytes = 0, now = Date.now()) {
  await assertWritable(transaction, uid);
  const policy = REQUEST_BUDGETS[scope];
  if (!Number.isSafeInteger(bytes) || bytes < 0) throw new Error('Invalid budget cost.');
  const owner = createHash('sha256').update(uid).digest('hex');
  const refs = [
    getAdminDb().collection('_requestBudgets').doc(`${scope}_user_${owner}`),
    getAdminDb().collection('_requestBudgets').doc(`${scope}_global`),
  ];
  const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
  const plans = snapshots.map((snapshot, index) => {
    const current = snapshot.data() as Bucket | undefined;
    const capacity = index === 0 ? policy.user : policy.global;
    const byteCapacity = index === 0 ? policy.userBytes : policy.globalBytes;
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

export async function enforceRequestBudget(uid: string, scope: BudgetScope) {
  return getAdminDb().runTransaction(async transaction => {
    const commit = await prepareRequestBudget(transaction, uid, scope);
    commit();
  });
}
