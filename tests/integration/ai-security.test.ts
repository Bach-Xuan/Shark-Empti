import { randomUUID, createHash } from 'node:crypto';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const provider = vi.hoisted(() => vi.fn());
vi.mock('@/ai/openrouter', () => ({ requestStructuredOnce: provider }));
import { POST as create } from '@/app/api/ai/generations/route';
import { POST as attempt } from '@/app/api/ai/generations/[generationId]/attempt/route';
import { GET as status, DELETE as cancel } from '@/app/api/ai/generations/[generationId]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { createGeneration, claimGeneration, getGeneration, finalizeGeneration } from '@/ai/generation-store';
import { Timestamp } from 'firebase-admin/firestore';
import { AI_IO_LIMITS } from '@/ai/config/limits';

let token: string, uid: string;
const input = { topic: 'Algebra', language: 'en' };
const context = (id: string) => ({ params: Promise.resolve({ generationId: id }) });
function request(body?: unknown, bearer: string | null = token) {
  return new Request('http://localhost/api/ai/generations', { method: 'POST', headers: bearer === null ? {} : { Authorization: `Bearer ${bearer}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
beforeAll(async () => {
  process.env.GCLOUD_PROJECT = 'demo-shark-empti';
  process.env.AI_GENERATION_PROTOCOL_ENABLED = 'true';
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  const account = await response.json(); token = account.idToken; uid = account.localId;
  expect(token).toBeTruthy();
});
beforeEach(async () => {
  provider.mockReset().mockResolvedValue({ ok: true, data: { isAcademic: true } });
  const cleared = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  expect(cleared.ok).toBe(true);
});
it.each(['missing', 'invalid', 'tampered-expiry'])('rejects %s credentials on every AI route before upstream work', async kind => {
  const parts = token.split('.');
  const expired = JSON.parse(Buffer.from(parts[1], 'base64url').toString()); expired.exp = 1;
  const bearer = kind === 'missing' ? null : kind === 'invalid' ? 'invalid' : `${parts[0]}.${Buffer.from(JSON.stringify(expired)).toString('base64url')}.${parts[2]}`;
  const id = randomUUID();
  const responses = await Promise.all([create(request({}, bearer)), attempt(request(undefined, bearer), context(id)), status(request(undefined, bearer), context(id)), cancel(request(undefined, bearer), context(id))]);
  expect(responses.map(r => r.status)).toEqual([401, 401, 401, 401]);
  expect(provider).not.toHaveBeenCalled();
  expect((await getAdminDb().collection('_aiGenerations').get()).empty).toBe(true);
});
it('rejects oversized unannounced bodies and operation input before ledger/provider work', async () => {
  expect((await create(request({ padding: 'x'.repeat(140001) }))).status).toBe(413);
  expect((await create(request({ generationId: randomUUID(), operation: 'academic-validation', input: { topic: 'x'.repeat(50000), language: 'en' } }))).status).toBe(413);
  expect(provider).not.toHaveBeenCalled();
  expect((await getAdminDb().collection('_aiGenerations').get()).empty).toBe(true);
});
it('accepts a valid owner, rejects another owner and invokes the provider only once for simultaneous retries', async () => {
  const id = randomUUID();
  expect((await create(request({ generationId: id, operation: 'academic-validation', input }))).status).toBe(200);
  let finish!: (v: unknown) => void;
  provider.mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const first = attempt(request(), context(id));
  await vi.waitFor(() => expect(provider).toHaveBeenCalledOnce());
  expect((await attempt(request(), context(id))).status).toBe(202);
  finish({ ok: true, data: { isAcademic: true } });
  expect((await first).status).toBe(200);
  expect((await attempt(request(), context(id))).status).toBe(200);
  expect(provider).toHaveBeenCalledOnce();
  await expect(claimGeneration(id, 'another-user')).rejects.toMatchObject({ status: 404 });
});
it('atomically limits concurrent generations and rolls back rejected quota reservations', async () => {
  const ids = Array.from({ length: 5 }, () => randomUUID());
  await Promise.all(ids.map(id => createGeneration(id, uid, 'academic-validation', input)));
  const claims = await Promise.allSettled(ids.map(id => claimGeneration(id, uid)));
  expect(claims.filter(r => r.status === 'fulfilled')).toHaveLength(2);
  for (const r of claims) if (r.status === 'rejected') expect(r.reason).toMatchObject({ code: 'AI-CONCURRENT-LIMIT', status: 429 });
  const db = getAdminDb();
  expect((await db.doc(`_aiQuota/user_${uid}`).get()).get('used')).toBe(2);
  expect((await db.doc('_aiQuota/global').get()).get('used')).toBe(2);
});
it.each(['user', 'global'])('rejects exhausted %s quota before provider invocation', async scope => {
  const id = randomUUID(), db = getAdminDb();
  await createGeneration(id, uid, 'academic-validation', input);
  await db.doc(scope === 'user' ? `_aiQuota/user_${uid}` : '_aiQuota/global').set({ windowStartMs: Date.now(), used: scope === 'user' ? 30 : 300, active: [] });
  expect((await attempt(request(), context(id))).status).toBe(429);
  expect(provider).not.toHaveBeenCalled();
  expect((await db.doc(`_aiGenerations/${id}`).get()).get('status')).toBe('ready');
});
it('enforces the global ceiling atomically across distinct users and resets an expired window', async () => {
  const db = getAdminDb();
  await db.doc('_aiQuota/global').set({ windowStartMs: Date.now(), used: 299, active: [] });
  const ids = [randomUUID(), randomUUID()];
  await Promise.all(ids.map((id, i) => createGeneration(id, `user-${i}`, 'academic-validation', input)));
  const claims = await Promise.allSettled(ids.map((id, i) => claimGeneration(id, `user-${i}`)));
  expect(claims.filter(r => r.status === 'fulfilled')).toHaveLength(1);
  expect((await db.doc('_aiQuota/global').get()).get('used')).toBe(300);
  await db.doc('_aiQuota/global').update({ windowStartMs: Date.now() - 900001 });
  const id = randomUUID(); await createGeneration(id, uid, 'academic-validation', input);
  expect((await claimGeneration(id, uid)).kind).toBe('claimed');
  expect((await db.doc('_aiQuota/global').get()).get('used')).toBe(1);
});

it('settles an expired running lease during status recovery and rejects its late finalizer', async () => {
  const db = getAdminDb();
  const id = randomUUID();
  await createGeneration(id, uid, 'academic-validation', input);
  const first = await claimGeneration(id, uid);
  expect(first.kind).toBe('claimed');
  if (first.kind !== 'claimed') throw new Error('Missing fixture lease');
  await db.doc(`_aiGenerations/${id}`).update({ 'inFlight.leaseExpiresAt': Timestamp.fromMillis(Date.now() - 1) });
  expect(await getGeneration(id, uid)).toMatchObject({ state: 'retryable' });
  expect((await db.doc(`_aiQuota/user_${uid}`).get()).get('active')).toEqual([]);
  expect((await db.doc(`_aiGenerations/${id}`).get()).get('attempts')).toHaveLength(1);
  const second = await claimGeneration(id, uid);
  expect(second).toMatchObject({ kind: 'claimed', attempt: 1 });
  await expect(finalizeGeneration(id, uid, first.leaseId, 0, 10, { data: { isAcademic: true } })).rejects.toMatchObject({ code: 'AI-LEASE-CONFLICT' });
  expect((await db.doc(`_aiGenerations/${id}`).get()).get('nextAttempt')).toBe(1);
});

it('terminates recovery after three expired leases without another provider invocation', async () => {
  const db = getAdminDb();
  const id = randomUUID();
  await createGeneration(id, uid, 'academic-validation', input);
  for (let ordinal = 0; ordinal < 3; ordinal++) {
    expect(await claimGeneration(id, uid)).toMatchObject({ kind: 'claimed', attempt: ordinal });
    await db.doc(`_aiGenerations/${id}`).update({ 'inFlight.leaseExpiresAt': Timestamp.fromMillis(Date.now() - 1) });
    expect((await getGeneration(id, uid)).state).toBe(ordinal === 2 ? 'failed' : 'retryable');
  }
  expect(await claimGeneration(id, uid)).toMatchObject({ kind: 'response', value: { state: 'failed' } });
  const stored = await db.doc(`_aiGenerations/${id}`).get();
  expect(stored.get('validatedInput')).toBeUndefined();
  expect(stored.get('attempts')).toHaveLength(3);
  expect(provider).not.toHaveBeenCalled();
});

it('bounds distinct creation/storage admission while leaving idempotent creation replays free', async () => {
  const id = randomUUID();
  await createGeneration(id, uid, 'academic-validation', input);
  await createGeneration(id, uid, 'academic-validation', input);
  for (let index = 1; index < 30; index++) await createGeneration(randomUUID(), uid, 'academic-validation', input);
  await expect(createGeneration(randomUUID(), uid, 'academic-validation', input)).rejects.toMatchObject({ status: 429 });
  expect((await getAdminDb().collection('_aiGenerations').get()).size).toBe(30);
  expect(provider).not.toHaveBeenCalled();
});

it('enforces aggregate input bytes and rolls back a rejected generation creation', async () => {
  const owner = createHash('sha256').update(uid).digest('hex');
  await getAdminDb().doc(`_requestBudgets/ai-create_user_${owner}`).set({ tokens: 10, bytes: 0, updatedAtMs: Date.now() + 10_000 });
  const id = randomUUID();
  await expect(createGeneration(id, uid, 'academic-validation', input)).rejects.toMatchObject({ status: 429 });
  expect((await getAdminDb().doc(`_aiGenerations/${id}`).get()).exists).toBe(false);
});

it('reserves the last global creation token atomically across users', async () => {
  await getAdminDb().doc('_requestBudgets/ai-create_global').set({ tokens: 1, bytes: 5_120_000, updatedAtMs: Date.now() + 10_000 });
  const results = await Promise.allSettled([0, 1].map(index => createGeneration(randomUUID(), `creator-${index}`, 'academic-validation', input)));
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1);
  expect((await getAdminDb().collection('_aiGenerations').get()).size).toBe(1);
});

it('limits authenticated status/cancel traffic before reading or mutating a generation', async () => {
  const id = randomUUID();
  await createGeneration(id, uid, 'academic-validation', input);
  const owner = createHash('sha256').update(uid).digest('hex');
  await getAdminDb().doc(`_requestBudgets/ai-traffic_user_${owner}`).set({ tokens: 0, bytes: 0, updatedAtMs: Date.now() + 10_000 });
  expect((await status(request(), context(id))).status).toBe(429);
  expect((await cancel(request(), context(id))).status).toBe(429);
  expect((await getAdminDb().doc(`_aiGenerations/${id}`).get()).get('status')).toBe('ready');
  expect(provider).not.toHaveBeenCalled();
});

it.each([
  { label: 'nonserializable', data: { answer: BigInt(1) } },
  { label: 'oversized', data: { answer: 'x'.repeat(AI_IO_LIMITS.storedResultBytes) } },
])('atomically fails $label output and releases its lease/quota', async ({ data }) => {
  const id = randomUUID();
  await createGeneration(id, uid, 'academic-validation', input);
  provider.mockResolvedValueOnce({ ok: true, data });
  const result = await attempt(request(), context(id));
  expect(result.status).toBe(422);
  expect(await result.json()).toMatchObject({ state: 'failed', error: { code: 'AI-PERSISTENCE-INVALID' } });
  const stored = await getAdminDb().doc(`_aiGenerations/${id}`).get();
  expect(stored.get('status')).toBe('failed');
  expect(stored.get('inFlight')).toBeUndefined();
  expect(stored.get('validatedInput')).toBeUndefined();
  expect((await getAdminDb().doc(`_aiQuota/user_${uid}`).get()).get('active')).toEqual([]);
  expect(await getGeneration(id, uid)).toMatchObject({ state: 'failed' });
  expect((await attempt(request(), context(id))).status).toBe(422);
  expect(provider).toHaveBeenCalledOnce();
});
