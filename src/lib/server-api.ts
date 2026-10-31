import { type Transaction } from 'firebase-admin/firestore';
import { NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import 'server-only';
import { ZodError } from 'zod';
import { AdminConfigurationError,getAdminAuth,getAdminDb } from './firebase-admin';
import { receiptExpiry } from './receipt-retention';

export class ApiError extends Error {
  constructor(public code: string, public status: number, message: string) { super(message); }
}
export async function authenticatedUser(request: Request, options: { allowLocked?: boolean; allowMaintenance?: boolean } = {}) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) throw new ApiError('AUTH-REQUIRED', 401, 'Authentication is required.');
  const auth = getAdminAuth();
  let uid: string;
  try { uid = (await auth.verifyIdToken(authorization.slice(7))).uid; }
  catch { throw new ApiError('AUTH-INVALID', 401, 'Authentication is invalid or expired.'); }
  await getAdminDb().runTransaction(async transaction => assertWritable(transaction, uid, options));
  return uid;
}

/** Read in the SAME transaction as a mutation to close deletion/backup races. */
export async function assertWritable(transaction: Transaction, uid: string, options: { allowLocked?: boolean; allowMaintenance?: boolean } = {}) {
  const db = getAdminDb();
  const [lock, maintenance] = await Promise.all([
    transaction.get(db.collection('_accountLocks').doc(uid)),
    transaction.get(db.collection('_serviceState').doc('maintenance')),
  ]);
  if (!options.allowLocked && ['deleting', 'deleted'].includes(lock.get('status'))) throw new ApiError('ACCOUNT-DELETING', 409, 'This account is being deleted.');
  if (!options.allowMaintenance && maintenance.get('active') === true && maintenance.get('expiresAtMs') > Date.now()) throw new ApiError('APP-MAINTENANCE', 503, 'Writes are temporarily paused for a consistent backup.');
}
export function apiFailure(error: unknown) {
  if (error instanceof AdminConfigurationError) return NextResponse.json({ error: 'Server configuration is unavailable.', code: 'APP-CONFIG-MISSING', values: {} }, { status: 503 });
  if (error instanceof ApiError) return NextResponse.json({ error: error.message, code: error.code, values: {} }, { status: error.status });
  if (error instanceof ZodError || error instanceof SyntaxError) return NextResponse.json({ error: 'Invalid request data.', code: 'APP-INVALID-INPUT', values: {} }, { status: 400 });
  return NextResponse.json({ error: 'Could not complete the request.', code: 'APP-REQUEST-FAILED', values: {} }, { status: 500 });
}

/** Receipt and business writes share a transaction, including concurrent retries. */
export async function idempotentTransaction<T extends object>(scope: string, uid: string, requestId: string | undefined, payload: unknown, operation: (transaction: Transaction) => Promise<T>): Promise<T> {
  const db = getAdminDb();
  const hash = (value: string) => createHash('sha256').update(value).digest('hex');
  const receipt = requestId ? db.collection('_requestReceipts').doc(hash(JSON.stringify([scope, uid, requestId]))) : null;
  const fingerprint = hash(JSON.stringify(payload));
  return db.runTransaction(async transaction => {
    await assertWritable(transaction, uid);
    if (receipt) {
      const previous = await transaction.get(receipt);
      if (previous.exists) {
        if (previous.get('fingerprint') !== fingerprint) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Request ID was already used with different data.');
        return previous.get('result') as T;
      }
    }
    const result = await operation(transaction);
    if (receipt) transaction.create(receipt, { ownerUid: uid, scope, fingerprint, result, createdAt: new Date(), expiresAt: receiptExpiry(new Date()) });
    return result;
  });
}
