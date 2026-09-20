import { randomUUID } from 'node:crypto';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
const provider = vi.hoisted(() => vi.fn());
vi.mock('@/ai/openrouter', () => ({ requestStructuredOnce: provider }));
import { POST as create } from '@/app/api/ai/generations/route';
import { POST as attempt } from '@/app/api/ai/generations/[generationId]/attempt/route';
import { GET as status, DELETE as cancel } from '@/app/api/ai/generations/[generationId]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { createGeneration, claimGeneration } from '@/ai/generation-store';

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
