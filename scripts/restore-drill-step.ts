import assert from 'node:assert/strict';
import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminAuth, getAdminDb } from '../src/lib/firebase-admin';
import { requireLocalEmulators } from './lib/demo-build.mjs';
import { POST as createExam } from '../src/app/api/arena/route';
import { POST as start } from '../src/app/api/arena/[examId]/start/route';
import { POST as submit } from '../src/app/api/arena/[examId]/submit/route';
import { POST as report } from '../src/app/api/community/reports/route';
import { POST as moderate } from '../src/app/api/community/moderation/route';
import { deleteForumPostTree } from '../src/lib/forum-deletion';
import { readHistoryItem } from '../src/lib/history-schema';

const uid = 'restore-drill-learner', author = 'restore-drill-author';
const attemptId = '11111111-1111-4111-8111-111111111111';
const password = 'Synthetic-emulator-only-123!';
function request(token: string, body: unknown) {
  return new NextRequest('http://localhost/api/restore-fixture', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
async function tokenFor(id: string) {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=emulator-only`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `${id}@example.invalid`, password, returnSecureToken: true }),
  });
  assert.equal(response.status, 200, 'Restored Auth account must be usable.');
  const data = await response.json();
  assert.equal(typeof data.idToken, 'string');
  return data.idToken as string;
}
async function main() {
  requireLocalEmulators();
  assert.equal(process.env.GCLOUD_PROJECT, 'demo-shark-empti');
  const mode = process.argv[2];
  assert.ok(mode === 'seed' || mode === 'verify');
  const db = getAdminDb(), auth = getAdminAuth();
  if (mode === 'seed') {
    for (const id of [uid, author]) await auth.createUser({ uid: id, email: `${id}@example.invalid`, password, displayName: 'Synthetic fixture' });
    await auth.setCustomUserClaims(author, { moderator: true });
    await db.doc(`users/${uid}`).set({ displayName: 'Synthetic fixture', sharkCoins: 0, createdAt: Timestamp.fromMillis(1_700_000_000_000) });
    const token = await tokenFor(uid), moderator = await tokenFor(author);
    const config = { topic: 'Addition', subject: 'math', grade: 'none', type: 'Mixed', difficulty: 'Easy', numQuestions: '1' };
    const questions = [{ question: '2+2?', correct: '4', explanation: 'Addition', type: 'Short Answer', difficulty: 'Easy' }];
    const created = await createExam(request(moderator, { title: 'Restore fixture', config, questions, requestId: crypto.randomUUID() }));
    assert.equal(created.status, 201);
    const { id: examId } = await created.json();
    const params = { params: Promise.resolve({ examId }) };
    assert.equal((await start(request(token, { requestId: attemptId }), params)).status, 200);
    const scored = await submit(request(token, { requestId: attemptId, answers: ['4'] }), params);
    assert.equal(scored.status, 200); assert.equal((await scored.json()).coinsAwarded, 150);
    await db.doc(`users/${uid}/history/session`).set({ schemaVersion: 2, config, date: Timestamp.fromDate(new Date('2026-01-01T00:00:00.000Z')), lang: 'en', totalTime: 3, quizResults: [{ ...questions[0], userAnswer: '4', isCorrect: true, timeTakenSeconds: 3 }] });
    const post = { title: 'Synthetic post', content: 'Synthetic content', subject: 'math', authorId: uid, authorName: 'Synthetic fixture', authorPhoto: '', createdAt: Timestamp.now(), likedBy: [], likesCount: 0, commentsCount: 0 };
    await db.doc('posts/restore-hidden').set(post);
    const reported = await report(request(token, { target: { kind: 'post', id: 'restore-hidden' }, reason: 'Synthetic drill review', requestId: crypto.randomUUID() }));
    assert.equal(reported.status, 201);
    const { id: reportId } = await reported.json();
    assert.equal((await moderate(request(moderator, { reportId, action: 'hide', reason: 'Synthetic reversible hide', requestId: crypto.randomUUID() }))).status, 200);
    await db.doc('posts/restore-deleted/comments/orphan').set({ content: 'Synthetic orphan', authorId: uid });
    await db.doc('_forumDeletions/restore-deleted').set({ authorId: uid, status: 'pending', createdAt: Timestamp.now() });
    await db.doc('_restoreDrill/state').set({ examId, reportId });
    console.log('Synthetic Auth, wallet/history, private Arena key/session/receipt, moderation archive and interrupted deletion seeded.');
    return;
  }
  const state = (await db.doc('_restoreDrill/state').get()).data()!;
  assert.ok(state?.examId && state?.reportId, 'Native import must preserve the drill manifest.');
  assert.equal((await db.doc(`users/${uid}`).get()).get('createdAt').toMillis(), 1_700_000_000_000);
  assert.ok(readHistoryItem('session', (await db.doc(`users/${uid}/history/session`).get()).data()));
  const token = await tokenFor(uid), moderator = await tokenFor(author);
  const params = { params: Promise.resolve({ examId: state.examId }) };
  const replay = await submit(request(token, { requestId: attemptId, answers: ['4'] }), params);
  assert.equal(replay.status, 200); assert.equal((await replay.json()).coinsAwarded, 150);
  assert.equal((await db.doc(`users/${uid}`).get()).get('sharkCoins'), 150, 'Restored retry cannot pay twice.');
  assert.equal((await db.collection(`arenaExams/${state.examId}/attempts`).get()).size, 1);
  assert.equal((await submit(request(token, { requestId: attemptId, answers: ['3'] }), params)).status, 409);
  const base = `http://${process.env.FIRESTORE_EMULATOR_HOST}/v1/projects/demo-shark-empti/databases/(default)/documents`;
  for (const path of [`_arenaAnswerKeys/${state.examId}`, `users/${uid}/history/session`, 'posts/restore-deleted/comments/orphan']) assert.equal((await fetch(`${base}/${path}`)).status, 403, 'Restored data must retain Rules privacy.');
  const publicExam = await fetch(`${base}/arenaExams/${state.examId}`);
  assert.equal(publicExam.status, 200); assert.equal((await publicExam.json()).fields.questions, undefined);
  assert.equal((await moderate(request(moderator, { reportId: state.reportId, action: 'restore', reason: 'Synthetic recovery validation', requestId: crypto.randomUUID() }))).status, 200);
  assert.equal((await db.doc('posts/restore-hidden').get()).get('content'), 'Synthetic content');
  await deleteForumPostTree(db, 'restore-deleted', uid);
  assert.equal((await db.collection('posts/restore-deleted/comments').get()).empty, true);
  assert.equal((await db.doc('_forumDeletions/restore-deleted').get()).get('status'), 'complete');
  console.log(JSON.stringify({ scope: 'isolated-demo-emulator', authRestored: true, historyAndTimestampValid: true, rewardsNotDuplicated: true, privateRulesVerified: true, moderationRestored: true, interruptedDeletionRecovered: true }));
}
void main().catch(() => { console.error('Synthetic restore validation failed; no production recovery claimed.'); process.exitCode = 1; });
