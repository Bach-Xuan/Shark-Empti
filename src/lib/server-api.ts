import { type Transaction } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import 'server-only';
import { ZodError } from 'zod';
import { AdminConfigurationError,getAdminAuth,getAdminDb } from './firebase-admin';
import { receiptExpiry } from './receipt-retention';
import { canonicalJson } from './canonical-json';
import { SERVICE_CONSENT_COLLECTION } from './service-policy';
import { hasCurrentServiceConsent } from './server-consent';

type AccountAccessOptions = { allowLocked?: boolean; allowMaintenance?: boolean; allowUnconsented?: boolean };

export class ApiError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export async function authenticatedUser(request: Request, options: AccountAccessOptions = {}) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ApiError('AUTH-REQUIRED', 401, 'Authentication is required.');
  const token = authorization.slice(7);
  if (!token || token.length > 8192 || /\s/.test(token)) throw new ApiError('AUTH-INVALID', 401, 'Authentication is invalid or expired.');
  const auth = getAdminAuth();
  let uid: string;
  try { uid = (await auth.verifyIdToken(token, true)).uid; }
  catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? error.code : '';
    if (['auth/argument-error', 'auth/invalid-argument', 'auth/invalid-id-token', 'auth/id-token-expired', 'auth/id-token-revoked', 'auth/user-disabled', 'auth/user-not-found'].includes(String(code))) {
      throw new ApiError('AUTH-INVALID', 401, 'Authentication is invalid or expired.');
    }
    // An Auth service outage is not evidence that the user's session is invalid.
    throw new ApiError('APP-UNAVAILABLE', 503, 'Authentication is temporarily unavailable.');
  }
  await getAdminDb().runTransaction(async transaction => assertWritable(transaction, uid, options));
  return uid;
}

/** Read in the SAME transaction as a mutation to close deletion/backup races. */
export async function assertWritable(transaction: Transaction, uid: string, options: AccountAccessOptions = {}) {
  const db = getAdminDb();
  const [lock, maintenance, consent] = await Promise.all([
    transaction.get(db.collection('_accountLocks').doc(uid)),
    transaction.get(db.collection('_serviceState').doc('maintenance')),
    options.allowUnconsented ? undefined : transaction.get(db.collection(SERVICE_CONSENT_COLLECTION).doc(uid)),
  ]);
  if (!options.allowLocked && lock.exists) throw new ApiError('ACCOUNT-DELETING', 409, 'Account writes are locked.');
  if (!options.allowMaintenance && maintenance.get('active') === true && maintenance.get('expiresAtMs') > Date.now()) throw new ApiError('APP-MAINTENANCE', 503, 'Writes are temporarily paused for a consistent backup.');
  if (consent && !hasCurrentServiceConsent(consent.data())) throw new ApiError('APP-CONSENT-REQUIRED', 403, 'Confirm the current service policy before using learning and community features.');
}
export function apiFailure(error: unknown) {
  if (error instanceof AdminConfigurationError) return NextResponse.json({ error: 'Server configuration is unavailable.', code: 'APP-CONFIG-MISSING', values: {} }, { status: 503 });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code, values: {} }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request data.', code: 'APP-INVALID-INPUT', values: {} }, { status: 400 });
  return NextResponse.json({ error: 'Could not complete the request.', code: 'APP-REQUEST-FAILED', values: {} }, { status: 500 });
}

/** Receipt and business writes share a transaction, including concurrent retries. */
export async function idempotentTransaction<T extends object>(scope: string, uid: string, requestId: string | undefined, payload: unknown, operation: (transaction: Transaction) => Promise<T>, options: AccountAccessOptions = {}): Promise<T> {
  const db = getAdminDb();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const receipt = requestId ? db.collection('_requestReceipts').doc(hash(JSON.stringify([scope, uid, requestId]))) : null;
  const fingerprint = hash(canonicalJson(payload));
  return db.runTransaction(async transaction => {
    await assertWritable(transaction, uid, options);
    if (receipt) {
      const previous = await transaction.get(receipt);
      if (previous.exists) {
        // Retained legacy receipts lack the original payload: preserve their exact
        // comparison rather than accepting an unverifiable changed request.
        const expected = previous.get('fingerprintVersion') === 2 ? fingerprint : hash(JSON.stringify(payload));
        if (previous.get('fingerprint') !== expected) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Request ID was already used with different data.');
        return previous.get('result') as T;
      }
    }
    const result = await operation(transaction);
    if (receipt) transaction.create(receipt, { ownerUid: uid, scope, fingerprintVersion: 2, fingerprint, result, createdAt: new Date(), expiresAt: receiptExpiry(new Date()) });
    return result;
  });
}
