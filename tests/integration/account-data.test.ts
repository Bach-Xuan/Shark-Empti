import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { POST as exportPage } from '@/app/api/account/export/route';
import { POST as requestReview, GET as requestStatus } from '@/app/api/account/requests/route';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
vi.mock('server-only', () => ({}));
let token: string, otherToken: string, uid: string;
function request(body: unknown, bearer = token, method = 'POST') {
  return new NextRequest('http://localhost/api/account', { method, headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
}
beforeAll(async () => {
  for (let index = 0; index < 2; index++) {
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
    const data = await response.json();
    if (index === 0) { token = data.idToken; uid = data.localId; } else otherToken = data.idToken;
  }
});
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  await getAdminDb().doc(`users/${uid}`).set({ displayName: 'Learner', sharkCoins: 23 });
});
it('exports only authenticated-owner datasets, preserves tagged values and never includes Auth credentials', async () => {
  const db = getAdminDb();
  await db.doc(`users/${uid}/notes/main`).set({ text: 'Owned note', at: Timestamp.fromMillis(123456), bytes: Buffer.from([0, 1]), reference: db.doc('users/other') });
  await db.doc('users/other/notes/main').set({ text: 'Foreign secret' });
  expect((await exportPage(request({ dataset: 'notes', uid: 'other' }))).status).toBe(400);
  expect((await exportPage(request({ dataset: '_arenaAnswerKeys' }))).status).toBe(400);
  const response = await exportPage(request({ dataset: 'notes' }));
  expect(response.status).toBe(200); expect(response.headers.get('cache-control')).toBe('no-store');
  const data = await response.json();
  expect(data.uid).toBe(uid); expect(data.documents).toHaveLength(1);
  expect(data.documents[0].data).toMatchObject({ text: 'Owned note', at: { $type: 'timestamp' }, bytes: { $type: 'bytes', base64: 'AAE=' }, reference: { $type: 'reference', path: 'users/other' } });
  expect(JSON.stringify(data)).not.toContain('Foreign secret');
  const profile = await (await exportPage(request({ dataset: 'profile' }))).json();
  expect(profile.identity.uid).toBe(uid);
  expect(profile.identity).not.toHaveProperty('passwordHash'); expect(profile.identity).not.toHaveProperty('refreshToken');
});
it('pages exports with an exact continuation instead of dropping or repeating records', async () => {
  const db = getAdminDb();
  for (let index = 0; index < 11; index++) await db.doc(`users/${uid}/history/item-${String(index).padStart(2, '0')}`).set({ index });
  const first = await (await exportPage(request({ dataset: 'history' }))).json();
  expect(first.documents).toHaveLength(10); expect(first.nextCursor).toBe('item-09');
  const second = await (await exportPage(request({ dataset: 'history', cursor: first.nextCursor }))).json();
  expect(second.documents).toHaveLength(1); expect(second.nextCursor).toBeNull();
  expect([...first.documents, ...second.documents].map(item => item.data.index)).toEqual(Array.from({ length: 11 }, (_, index) => index));
});
it('saves private bounded requests idempotently but never pretends to execute deletion', async () => {
  const first = { kind: 'export', requestId: crypto.randomUUID() };
  const requested = await requestReview(request(first)); expect(requested.status).toBe(202);
  expect(await requested.json()).toMatchObject({ status: 'pending-operator', automatedDeletion: false, operatorConfigured: false });
  expect((await requestReview(request({ kind: 'deletion', requestId: crypto.randomUUID() }))).status).toBe(202);
  expect((await requestReview(request({ kind: 'export', requestId: crypto.randomUUID() }))).status).toBe(202);
  expect((await requestReview(request({ kind: 'export', requestId: crypto.randomUUID() }))).status).toBe(429);
  expect((await requestReview(request(first))).status).toBe(202);
  expect((await getAdminDb().collection('_accountRequests').get()).size).toBe(2);
  expect((await getAdminDb().doc(`users/${uid}`).get()).get('sharkCoins')).toBe(23);
  expect((await getAdminAuth().getUser(uid)).uid).toBe(uid);
  expect((await (await requestStatus(request(null, token, 'GET'))).json()).requests).toHaveLength(2);
  expect((await (await requestStatus(request(null, otherToken, 'GET'))).json()).requests).toHaveLength(0);
});
