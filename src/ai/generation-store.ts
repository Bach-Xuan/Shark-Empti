import 'server-only';
import { createHash,randomUUID } from 'node:crypto';
import { FieldValue,Timestamp,type Transaction } from 'firebase-admin/firestore';
import { getAdminDb } from '@/lib/firebase-admin';
import { ApiError } from '@/lib/server-api';
import { createAppError,type AppError } from '@/lib/app-error';
import { getAiOperationDefinition } from './operation-registry';
import type { AiGenerationState,AiOperation,AiProtocolResponse } from './protocol';
import type { NormalizedAiFailure } from './openrouter';
import type { RetryDecision } from './error-classifier';

type AttemptOrdinal = 0 | 1 | 2;
type AttemptRecord = { attempt: AttemptOrdinal; outcome: string; durationMs: number; completedAt: Timestamp };
type GenerationRecord = {
  ownerUid: string; operation: AiOperation; inputFingerprint: string; validatedInput: unknown; status: AiGenerationState; nextAttempt: 0 | 1 | 2 | 3;
  inFlight?: { attempt: AttemptOrdinal; leaseId: string; leaseExpiresAt: Timestamp; startedAt: Timestamp };
  attempts: AttemptRecord[]; result?: unknown; terminalError?: AppError; retryNotBefore?: Timestamp;
  createdAt: Timestamp; updatedAt: Timestamp; expiresAt: Timestamp;
};

const COLLECTION = '_aiGenerations';
const LEASE_MS = 35_000;
const RETENTION_MS = 24 * 60 * 60 * 1_000;
const WINDOW_MS = 15 * 60 * 1_000;
const USER_BUDGET = 30;
const GLOBAL_BUDGET = 300;
const ACTIVE_TTL_MS = 40_000;

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
const fingerprint = (uid: string, operation: AiOperation, input: unknown) => createHash('sha256').update(canonical([uid, operation, input])).digest('hex');
const safeError = (failure: NormalizedAiFailure): AppError => createAppError(failure.code, failure.kind === 'configuration' ? 'The AI service is not configured.' : 'The AI request could not be completed.');

function response(id: string, record: GenerationRecord): AiProtocolResponse {
  return { generationId: id, state: record.status, ...(record.result !== undefined ? { data: record.result } : {}), ...(record.terminalError ? { error: record.terminalError } : {}), ...(record.status === 'running' ? { pollAfterMs: 1_000 } : {}) };
}

export async function createGeneration(id: string, uid: string, operation: AiOperation, input: unknown) {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  const inputFingerprint = fingerprint(uid, operation, input);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (snapshot.exists) {
      const current = snapshot.data() as GenerationRecord;
      if (current.ownerUid !== uid) throw new ApiError('APP-NOT-FOUND', 404, 'Generation was not found.');
      if (current.inputFingerprint !== inputFingerprint || current.operation !== operation) throw new ApiError('APP-REQUEST-CONFLICT', 409, 'Generation ID was already used with different data.');
      return response(id, current);
    }
    const now = Timestamp.now();
    const record: GenerationRecord = { ownerUid: uid, operation, inputFingerprint, validatedInput: input, status: 'ready', nextAttempt: 0, attempts: [], createdAt: now, updatedAt: now, expiresAt: Timestamp.fromMillis(now.toMillis() + RETENTION_MS) };
    transaction.create(ref, record);
    return response(id, record);
  });
}

export async function getGeneration(id: string, uid: string): Promise<AiProtocolResponse> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('ownerUid') !== uid) throw new ApiError('APP-NOT-FOUND', 404, 'Generation was not found.');
    const record = snapshot.data() as GenerationRecord;
    if (record.status === 'cancel_requested' && (!record.inFlight || record.inFlight.leaseExpiresAt.toMillis() <= Date.now())) {
      const terminalError = record.terminalError ?? createAppError('AI-CANCELLED', 'The AI request was cancelled.');
      transaction.update(ref, { status: 'cancelled', terminalError, updatedAt: Timestamp.now(), inFlight: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { generationId: id, state: 'cancelled', error: terminalError };
    }
    return response(id, record);
  });
}

type QuotaRecord = { windowStartMs?: number; used?: number; active?: Array<{ generationId: string; expiresAtMs: number }> };
async function reserveQuota(transaction: Transaction, uid: string, generationId: string, weight: number, nowMs: number) {
  const db = getAdminDb();
  const userRef = db.collection('_aiQuota').doc(`user_${uid}`);
  const globalRef = db.collection('_aiQuota').doc('global');
  const [userSnapshot, globalSnapshot] = await Promise.all([transaction.get(userRef), transaction.get(globalRef)]);
  const apply = (current: QuotaRecord, limit: number, concurrentLimit?: number) => {
    const reset = !current.windowStartMs || nowMs - current.windowStartMs >= WINDOW_MS;
    const used = reset ? 0 : current.used ?? 0;
    const active = (current.active ?? []).filter(item => item.expiresAtMs > nowMs && item.generationId !== generationId);
    if (concurrentLimit && active.length >= concurrentLimit) throw new ApiError('AI-CONCURRENT-LIMIT', 429, 'Too many AI generations are running.');
    if (used + weight > limit) throw new ApiError('AI-QUOTA-EXCEEDED', 429, 'AI quota is temporarily exhausted.');
    return { windowStartMs: reset ? nowMs : current.windowStartMs, used: used + weight, active: [...active, { generationId, expiresAtMs: nowMs + ACTIVE_TTL_MS }], expiresAt: Timestamp.fromMillis(nowMs + WINDOW_MS * 2) };
  };
  transaction.set(userRef, apply(userSnapshot.data() ?? {}, USER_BUDGET, 2));
  transaction.set(globalRef, apply(globalSnapshot.data() ?? {}, GLOBAL_BUDGET));
}

export async function claimGeneration(id: string, uid: string): Promise<{ kind: 'claimed'; record: GenerationRecord; attempt: AttemptOrdinal; leaseId: string } | { kind: 'response'; value: AiProtocolResponse }> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('ownerUid') !== uid) throw new ApiError('APP-NOT-FOUND', 404, 'Generation was not found.');
    const record = snapshot.data() as GenerationRecord;
    const now = Timestamp.now();
    if (['succeeded', 'failed', 'cancelled', 'cancel_requested'].includes(record.status)) return { kind: 'response', value: response(id, record) };
    if (record.status === 'running' && record.inFlight && record.inFlight.leaseExpiresAt.toMillis() > now.toMillis()) return { kind: 'response', value: response(id, record) };
    if (record.retryNotBefore && record.retryNotBefore.toMillis() > now.toMillis()) return { kind: 'response', value: { ...response(id, record), retryAfterMs: record.retryNotBefore.toMillis() - now.toMillis() } };
    const recoveredAttempt = record.status === 'running' && record.inFlight ? record.inFlight.attempt + 1 : record.nextAttempt;
    if (recoveredAttempt >= 3) {
      const terminalError = createAppError('AI-FALLBACK-EXHAUSTED', 'The AI service could not complete this request.');
      transaction.update(ref, { status: 'failed', terminalError, nextAttempt: 3, updatedAt: now, inFlight: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { kind: 'response', value: { generationId: id, state: 'failed', error: terminalError } };
    }
    const definition = getAiOperationDefinition(record.operation);
    await reserveQuota(transaction, uid, id, definition.costWeight, now.toMillis());
    const attempt = recoveredAttempt as AttemptOrdinal;
    const leaseId = randomUUID();
    const recoveredAttempts = record.status === 'running' && record.inFlight
      ? [...record.attempts, { attempt: record.inFlight.attempt, outcome: 'lease_expired', durationMs: Math.max(0, now.toMillis() - record.inFlight.startedAt.toMillis()), completedAt: now }]
      : record.attempts;
    transaction.update(ref, { status: 'running', nextAttempt: attempt, attempts: recoveredAttempts, inFlight: { attempt, leaseId, leaseExpiresAt: Timestamp.fromMillis(now.toMillis() + LEASE_MS), startedAt: now }, updatedAt: now, retryNotBefore: FieldValue.delete() });
    return { kind: 'claimed', record, attempt, leaseId };
  });
}

async function releaseQuota(transaction: Transaction, uid: string, generationId: string) {
  const db = getAdminDb();
  const refs = [db.collection('_aiQuota').doc(`user_${uid}`), db.collection('_aiQuota').doc('global')];
  const snapshots = await Promise.all(refs.map(ref => transaction.get(ref)));
  snapshots.forEach((snapshot, index) => {
    if (snapshot.exists) transaction.update(refs[index], { active: ((snapshot.data() as QuotaRecord).active ?? []).filter(item => item.generationId !== generationId) });
  });
}

export async function finalizeGeneration(id: string, uid: string, leaseId: string, attempt: AttemptOrdinal, durationMs: number, outcome: { data: unknown } | { failure: NormalizedAiFailure; decision: RetryDecision; retryAfterMs?: number }): Promise<AiProtocolResponse> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('ownerUid') !== uid) throw new ApiError('APP-NOT-FOUND', 404, 'Generation was not found.');
    const record = snapshot.data() as GenerationRecord;
    if (record.inFlight?.leaseId !== leaseId) return response(id, record);
    const now = Timestamp.now();
    await releaseQuota(transaction, uid, id);
    const attempts = [...record.attempts, { attempt, outcome: 'data' in outcome ? 'succeeded' : outcome.failure.code, durationMs, completedAt: now }];
    if (record.status === 'cancel_requested') {
      const terminalError = createAppError('AI-CANCELLED', 'The AI request was cancelled.');
      transaction.update(ref, { status: 'cancelled', terminalError, attempts, updatedAt: now, inFlight: FieldValue.delete(), result: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { generationId: id, state: 'cancelled', error: terminalError };
    }
    if ('data' in outcome) {
      transaction.update(ref, { status: 'succeeded', result: outcome.data, attempts, updatedAt: now, inFlight: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { generationId: id, state: 'succeeded', data: outcome.data };
    }
    const error = safeError(outcome.failure);
    if (outcome.decision === 'cancelled') {
      transaction.update(ref, { status: 'cancelled', terminalError: error, attempts, updatedAt: now, inFlight: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { generationId: id, state: 'cancelled', error };
    }
    if (outcome.decision === 'terminal' || attempt === 2) {
      transaction.update(ref, { status: 'failed', terminalError: error, attempts, nextAttempt: attempt + 1, updatedAt: now, inFlight: FieldValue.delete(), validatedInput: FieldValue.delete() });
      return { generationId: id, state: 'failed', error };
    }
    const retryAfterMs = outcome.retryAfterMs ?? 0;
    transaction.update(ref, { status: 'retryable', terminalError: error, attempts, nextAttempt: attempt + 1, updatedAt: now, inFlight: FieldValue.delete(), ...(retryAfterMs ? { retryNotBefore: Timestamp.fromMillis(now.toMillis() + retryAfterMs) } : {}) });
    return { generationId: id, state: 'retryable', error, retryAfterMs };
  });
}

export async function cancelGeneration(id: string, uid: string): Promise<AiProtocolResponse> {
  const db = getAdminDb();
  const ref = db.collection(COLLECTION).doc(id);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists || snapshot.get('ownerUid') !== uid) throw new ApiError('APP-NOT-FOUND', 404, 'Generation was not found.');
    const record = snapshot.data() as GenerationRecord;
    if (['succeeded', 'failed', 'cancelled'].includes(record.status)) return response(id, record);
    const state = record.status === 'running' ? 'cancel_requested' : 'cancelled';
    const terminalError = createAppError('AI-CANCELLED', 'The AI request was cancelled.');
    transaction.update(ref, { status: state, terminalError, updatedAt: Timestamp.now(), ...(state === 'cancelled' ? { validatedInput: FieldValue.delete() } : {}) });
    return { generationId: id, state, error: terminalError };
  });
}
