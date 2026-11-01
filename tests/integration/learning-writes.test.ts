import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { Timestamp } from 'firebase-admin/firestore';
vi.mock('server-only', () => ({}));
import { PUT, PATCH } from '@/app/api/learning/[kind]/[recordId]/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { seedServiceConsent } from '../fixtures/service-consent';
import { history, analysis } from '../fixtures/quiz';

let uid: string, token: string, otherUid: string, otherToken: string;
const question = { question: '2+2?', correct: '4', explanation: 'Addition', type: 'Multiple Choice', options: ['4', '3', '2', '1'] };
const bodies = {
  history: { ...history, schemaVersion: 2 },
  flashcards: { sourceType: 'manual', sourceValue: 'Addition', cards: [{ front: '2+2?', back: '4' }] },
  practice: { concept: 'Addition', questions: [question], userAnswers: [{ ...question, userAnswer: '4', isCorrect: true }], score: 100 },
};
const context = (kind: string, recordId: string) => ({ params: Promise.resolve({ kind, recordId }) });
function request(data: unknown, method = 'PUT', bearer = token) {
  return new Request('http://localhost/api/learning', { method, headers: bearer ? { Authorization: `Bearer ${bearer}` } : {}, body: JSON.stringify(data) });
}
beforeAll(async () => {
  for (let index = 0; index < 2; index++) {
    const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
    });
    const account = await response.json();
    if (!index) { uid = account.localId; token = account.idToken; } else { otherUid = account.localId; otherToken = account.idToken; }
  }
});
beforeEach(async () => {
  const cleared = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  expect(cleared.ok).toBe(true);
  await seedServiceConsent(uid, otherUid);
});
it.each(['history', 'flashcards', 'practice'] as const)('persists validated %s once under concurrent/lost-response retries with canonical timestamps', async kind => {
  const id = crypto.randomUUID(), input = bodies[kind];
  const results = await Promise.all([PUT(request(input), context(kind, id)), PUT(request(input), context(kind, id))]);
  expect(results.map(response => response.status).sort()).toEqual([200, 201]);
  const ref = getAdminDb().doc(`users/${uid}/${kind}/${id}`), saved = (await ref.get()).data()!;
  expect(saved.userId).toBe(uid); expect(saved.writeFingerprint).toMatch(/^[a-f0-9]{64}$/);
  const field = kind === 'history' ? 'date' : 'createdAt';
  expect(saved[field]).toBeInstanceOf(Timestamp);
  if (kind === 'history') expect(saved.date.toMillis()).toBe(history.date);
  expect((await PUT(request(input), context(kind, id))).status).toBe(200);
  expect((await ref.get()).get(field).isEqual(saved[field])).toBe(true);
  expect((await ref.parent.get()).size).toBe(1);
  const changed = kind === 'flashcards' ? { ...bodies.flashcards, sourceValue: 'Changed' }
    : kind === 'history' ? { ...bodies.history, totalTime: 2 } : { ...bodies.practice, concept: 'Changed' };
  expect((await PUT(request(changed), context(kind, id))).status).toBe(409);
});
it.each([
  ['history', { ...bodies.history, userId: 'forged' }], ['history', { ...bodies.history, date: '2026-09-03' }],
  ['history', { ...bodies.history, date: Date.now() + 86_400_000 }], ['history', { ...bodies.history, quizResults: [null] }],
  ['history', { ...bodies.history, config: { ...history.config, numQuestions: '2' } }],
  ['history', { ...bodies.history, quizResults: [{ ...history.quizResults[0], nestedSecret: true }] }],
  ['history', { ...bodies.history, quizResults: [{ ...history.quizResults[0], options: ['4'] }] }],
  ['flashcards', { ...bodies.flashcards, createdAt: 1 }], ['flashcards', { ...bodies.flashcards, cards: [{ front: 1, back: '4' }] }],
  ['flashcards', { ...bodies.flashcards, cards: Array.from({ length: 51 }, () => ({ front: 'Q', back: 'A' })) }],
  ['practice', { ...bodies.practice, userAnswers: [] }], ['practice', { ...bodies.practice, score: 0 }],
  ['practice', { ...bodies.practice, userAnswers: [{ ...bodies.practice.userAnswers[0], question: 'Another question' }] }],
])('rejects forged or malformed %s structures %# without persistence', async (kind, body) => {
  const response = await PUT(request(body), context(kind as string, crypto.randomUUID()));
  expect(response.status).toBe(400);
  expect((await getAdminDb().collection(`users/${uid}/${kind}`).get()).empty).toBe(true);
});
it('rejects oversized valid structures below the stream limit as well as oversized streams', async () => {
  const body = { ...bodies.flashcards, cards: Array.from({ length: 20 }, () => ({ front: 'x'.repeat(19000), back: 'x'.repeat(19000) })) };
  expect((await PUT(request(body), context('flashcards', crypto.randomUUID()))).status).toBe(413);
  expect((await PUT(request({ padding: 'x'.repeat(800001) }), context('history', crypto.randomUUID()))).status).toBe(413);
});
it('attaches feedback without changing completion, answers or creation identity, and replay cannot roll it back', async () => {
  const id = crypto.randomUUID(), initial = { ...bodies.history, analysis: undefined };
  expect((await PUT(request(initial), context('history', id))).status).toBe(201);
  const ref = getAdminDb().doc(`users/${uid}/history/${id}`), before = (await ref.get()).data()!;
  const feedback = { analysis, topicEn: 'Addition', topicVi: 'Phép cộng' };
  expect((await PATCH(request(feedback, 'PATCH'), context('history', id))).status).toBe(200);
  expect((await PATCH(request(feedback, 'PATCH'), context('history', id))).status).toBe(200);
  expect((await PUT(request(initial), context('history', id))).status).toBe(200);
  const after = (await ref.get()).data()!;
  expect(after.date.isEqual(before.date)).toBe(true); expect(after.quizResults).toEqual(before.quizResults);
  expect(after.writeFingerprint).toBe(before.writeFingerprint); expect(after.analysis).toEqual(analysis);
  expect(after.config).toMatchObject({ topicEn: 'Addition', topicVi: 'Phép cộng' });
  expect((await PATCH(request({ ...feedback, date: 1 }, 'PATCH'), context('history', id))).status).toBe(400);
  expect((await PATCH(request(feedback, 'PATCH', otherToken), context('history', id))).status).toBe(404);
});
it('keeps legacy history feedback recovery non-destructive and refuses invalid legacy core data', async () => {
  const ref = getAdminDb().doc(`users/${uid}/history/legacy`);
  await ref.set({ ...history, config: { ...history.config, preservedNested: 'Retain nested' }, date: new Date(history.date).toISOString(), preservedUnknown: 'Retain' });
  const feedback = { analysis, topicEn: 'Addition', topicVi: 'Phép cộng' };
  expect((await PATCH(request(feedback, 'PATCH'), context('history', 'legacy'))).status).toBe(200);
  expect((await ref.get()).get('date')).toBe(new Date(history.date).toISOString());
  expect((await ref.get()).get('preservedUnknown')).toBe('Retain');
  expect((await ref.get()).get('config.preservedNested')).toBe('Retain nested');
  await ref.update({ quizResults: [null] });
  expect((await PATCH(request(feedback, 'PATCH'), context('history', 'legacy'))).status).toBe(409);
});
it('rejects unknown routes, forged identity, missing authentication and active write barriers', async () => {
  const id = crypto.randomUUID();
  expect((await PUT(request(bodies.history, 'PUT', ''), context('history', id))).status).toBe(401);
  expect((await PUT(request(bodies.history), context('unknown', id))).status).toBe(400);
  expect((await PUT(request(bodies.history), context('history', '../bad'))).status).toBe(400);
  const db = getAdminDb();
  await db.doc('_accountLocks/' + uid).set({ status: 'synthetic-save-failure' });
  expect((await PUT(request(bodies.history), context('history', id))).status).toBe(409);
  await db.doc('_accountLocks/' + uid).delete();
  await db.doc('_serviceState/maintenance').set({ active: true, expiresAtMs: Date.now() + 60000 });
  expect((await PUT(request(bodies.history), context('history', id))).status).toBe(503);
  await db.doc('_serviceState/maintenance').delete(); await db.doc('_serviceConsents/' + uid).delete();
  expect((await PUT(request(bodies.history), context('history', id))).status).toBe(403);
});
it.each(['lock', 'consent'])('rechecks %s after admission and body parsing before committing', async barrier => {
  const id = crypto.randomUUID(), db = getAdminDb();
  const body = new ReadableStream({ async pull(controller) {
    if (barrier === 'lock') await db.doc('_accountLocks/' + uid).set({ status: 'deleting' });
    else await db.doc('_serviceConsents/' + uid).delete();
    controller.enqueue(new TextEncoder().encode(JSON.stringify(bodies.history))); controller.close();
  } }, { highWaterMark: 0 });
  const streamed = new Request('http://localhost/api/learning', { method: 'PUT', headers: { Authorization: `Bearer ${token}` }, body, duplex: 'half' } as RequestInit);
  expect((await PUT(streamed, context('history', id))).status).toBe(barrier === 'lock' ? 409 : 403);
  expect((await db.doc(`users/${uid}/history/${id}`).get()).exists).toBe(false);
});
it('reserves the last write allowance atomically across owners and leaves rejected records absent', async () => {
  const db = getAdminDb();
  await db.doc('_requestBudgets/learning-write_global').set({ tokens: 1, bytes: 240000000, updatedAtMs: Date.now() + 60000 });
  const results = await Promise.all([PUT(request(bodies.history), context('history', crypto.randomUUID())),
    PUT(request(bodies.history, 'PUT', otherToken), context('history', crypto.randomUUID()))]);
  expect(results.map(response => response.status).sort()).toEqual([201, 429]);
  const saved = await Promise.all([uid, otherUid].map(owner => db.collection(`users/${owner}/history`).get()));
  expect(saved.reduce((sum, page) => sum + page.size, 0)).toBe(1);
});
