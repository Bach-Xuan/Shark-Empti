import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('server-only', () => ({}));
import { getAdminDb } from '@/lib/firebase-admin';
import { POST as createPost } from '@/app/api/forum/route';
import { GET as consentStatus, POST as acceptConsent } from '@/app/api/account/consent/route';
import { POST as exportLearningData } from '@/app/api/account/export/route';
import { GET as accountJobs } from '@/app/api/account/jobs/route';
import { assertWritable } from '@/lib/server-api';
import { currentServicePolicy, SERVICE_CONSENT_COLLECTION } from '@/lib/service-policy';

let uid: string, token: string;
beforeAll(async () => {
  process.env.GCLOUD_PROJECT = 'demo-shark-empti';
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  });
  const account = await response.json(); uid = account.localId; token = account.idToken;
  expect(token).toBeTruthy();
});
beforeEach(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  expect(response.ok).toBe(true);
});
function publish() {
  return createPost(new NextRequest('http://localhost/api/forum', { method: 'POST', headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ title: 'A question', content: 'Help with algebra', subject: 'math', requestId: crypto.randomUUID() }) }));
}
function request(body?: unknown, bearer = token) {
  return new NextRequest('http://localhost/api/account/consent', { method: body === undefined ? 'GET' : 'POST',
    headers: { Authorization: `Bearer ${bearer}` }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
}
it('rejects business mutations without server-owned consent even when the client forges the legacy preference', async () => {
  await getAdminDb().doc(`users/${uid}/preferences/service`).set({ policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.now() });
  const response = await publish();
  expect(response.status).toBe(403);
  expect(await response.json()).toMatchObject({ code: 'APP-CONSENT-REQUIRED' });
  expect((await getAdminDb().collection('posts').get()).empty).toBe(true);
});
it.each([
  { policyVersion: 'old', minimumAge: 16, acceptedAt: Timestamp.fromMillis(1) },
  { policyVersion: '2', minimumAge: 15, acceptedAt: Timestamp.fromMillis(1) },
  { policyVersion: '2', minimumAge: 16, acceptedAt: null },
  { policyVersion: '2', minimumAge: 16, acceptedAt: Timestamp.fromMillis(Date.now() + 86_400_000) },
])('rejects obsolete or malformed server acknowledgements %#', async record => {
  await getAdminDb().collection(SERVICE_CONSENT_COLLECTION).doc(uid).set(record);
  expect((await publish()).status).toBe(403);
  expect(await (await consentStatus(request())).json()).toMatchObject({ accepted: false });
});
it('records the authenticated owner acknowledgement once, admits business work and rechecks before later transactions', async () => {
  const input = { ...currentServicePolicy, accept: true };
  const first = await acceptConsent(request(input));
  expect(first.status).toBe(200);
  expect(first.headers.get('cache-control')).toBe('no-store');
  const ref = getAdminDb().collection(SERVICE_CONSENT_COLLECTION).doc(uid);
  const recorded = (await ref.get()).get('acceptedAt') as Timestamp;
  expect(recorded).toBeInstanceOf(Timestamp);
  expect((await acceptConsent(request(input))).status).toBe(200);
  expect((await ref.get()).get('acceptedAt').isEqual(recorded)).toBe(true);
  expect(await (await consentStatus(request())).json()).toMatchObject({ ...currentServicePolicy, accepted: true });
  expect((await publish()).status).toBe(201);
  await ref.delete();
  await expect(getAdminDb().runTransaction(transaction => assertWritable(transaction, uid))).rejects.toMatchObject({ code: 'APP-CONSENT-REQUIRED' });
  expect((await publish()).status).toBe(403);
});
it.each([
  { ...currentServicePolicy, accept: false }, { ...currentServicePolicy, accept: true, uid: 'another-owner' },
  { ...currentServicePolicy, policyVersion: 'old', accept: true }, { ...currentServicePolicy, minimumAge: 15, accept: true },
])('requires explicit current eligibility and rejects forged authority %#', async input => {
  expect((await acceptConsent(request(input))).status).toBe(400);
  expect((await getAdminDb().collection(SERVICE_CONSENT_COLLECTION).get()).empty).toBe(true);
});
it('keeps owner data controls available without learning consent and honors deletion/backup write barriers', async () => {
  const exported = await exportLearningData(request({ dataset: 'profile' }));
  expect(exported.status).toBe(200);
  expect(await exported.json()).toMatchObject({ uid, serviceConsent: null });
  expect((await accountJobs(request())).status).toBe(200);
  const db = getAdminDb();
  await db.doc('_accountLocks/' + uid).set({ status: 'deleting' });
  expect((await consentStatus(request())).status).toBe(200);
  expect((await acceptConsent(request({ ...currentServicePolicy, accept: true }))).status).toBe(409);
  await db.doc('_accountLocks/' + uid).delete();
  await db.doc('_serviceState/maintenance').set({ active: true, expiresAtMs: Date.now() + 60_000 });
  expect((await consentStatus(request())).status).toBe(200);
  expect((await acceptConsent(request({ ...currentServicePolicy, accept: true }))).status).toBe(503);
});
it('authenticates both consent endpoints and limits status traffic before exposing a record', async () => {
  expect((await consentStatus(request(undefined, 'invalid'))).status).toBe(401);
  expect((await acceptConsent(request({ ...currentServicePolicy, accept: true }, 'invalid'))).status).toBe(401);
  await getAdminDb().doc('_requestBudgets/account-traffic_global').set({ tokens: 0, bytes: 0, updatedAtMs: Date.now() + 60_000 });
  expect((await consentStatus(request())).status).toBe(429);
});
