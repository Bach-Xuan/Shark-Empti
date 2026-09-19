import { POST as submit } from '@/app/api/arena/[examId]/submit/route';
import { DELETE as deletePost } from '@/app/api/forum/[postId]/route';
import { POST as createExam } from '@/app/api/arena/route';
import { POST as comment,DELETE as deleteComment } from '@/app/api/forum/[postId]/comments/route';
import { getAdminDb } from '@/lib/firebase-admin';
import { NextRequest } from 'next/server';
import { beforeAll,beforeEach,expect,it,vi } from 'vitest';
vi.mock('server-only', () => ({}));

let token: string;
let uid: string;
const params = { params: Promise.resolve({ examId: 'exam' }) };
const postParams = { params: Promise.resolve({ postId: 'post' }) };
const question = { question: '2 + 2?', correct: '4', type: 'Short Answer', explanation: 'Addition', difficulty: 'Easy' };
function request(body: unknown, path = '/api/arena/exam/submit', bearer = token) {
  return new NextRequest(`http://localhost${path}`, { method: 'POST', headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
}
beforeAll(async () => {
  process.env.GCLOUD_PROJECT = 'demo-shark-empti';
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: `api-${Date.now()}@example.test`, password: 'Testing123!', returnSecureToken: true }),
  });
  const account = await response.json(); token = account.idToken; uid = account.localId;
  expect(token).toBeTruthy();
});
beforeEach(async () => {
  const response = await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  expect(response.ok).toBe(true);
  const db = getAdminDb();
  await db.doc('arenaExams/exam').set({ title: 'Exam', config: { subject: 'math', grade: '12', topic: 'Math', type: 'Mixed', difficulty: 'Mixed', numQuestions: '1' }, questions: [question], totalAttempts: 0, authorId: uid });
  await db.doc('posts/post').set({ title: 'Post', content: 'Body', subject: 'math', commentsCount: 0, likesCount: 0, likedBy: [], authorId: uid });
});
it('commits one Arena attempt and one reward for concurrent retries', async () => {
  const body = { answers: ['4'], duration: 2, requestId: crypto.randomUUID() };
  const responses = await Promise.all([submit(request(body), params), submit(request(body), params)]);
  expect(responses.map(r => r.status)).toEqual([200, 200]);
  expect(await responses[0].json()).toEqual(await responses[1].json());
  const db = getAdminDb();
  expect((await db.collection('arenaExams/exam/attempts').get()).size).toBe(1);
  expect((await db.doc('arenaExams/exam').get()).get('totalAttempts')).toBe(1);
  expect((await db.doc(`users/${uid}`).get()).get('sharkCoins')).toBeGreaterThan(0);
  expect((await submit(request({ ...body, answers: ['3'] }), params)).status).toBe(409);
});
it('rejects invalid tokens, null payloads and legacy free-text exams', async () => {
  expect((await submit(request({}, undefined, 'invalid'), params)).status).toBe(401);
  expect((await submit(request(null), params)).status).toBe(400);
  await getAdminDb().doc('arenaExams/exam').update({ questions: [{ ...question, correct: 'four' }] });
  expect((await submit(request({ answers: ['four'] }), params)).status).toBe(409);
});
it('creates a comment once and decrements the counter on authorized delete', async () => {
  const body = { content: 'Hello', requestId: crypto.randomUUID() };
  expect((await comment(request(body), postParams)).status).toBe(201);
  expect((await comment(request(body), postParams)).status).toBe(201);
  const db = getAdminDb();
  const comments = await db.collection('posts/post/comments').get();
  expect(comments.size).toBe(1);
  expect((await db.doc('posts/post').get()).get('commentsCount')).toBe(1);
  const deletion = new NextRequest(`http://localhost/api/forum/post/comments?commentId=${comments.docs[0].id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  expect((await deleteComment(deletion, postParams)).status).toBe(200);
  expect((await db.doc('posts/post').get()).get('commentsCount')).toBe(0);
});

it('recursively deletes more than 500 descendants and keeps owner retries idempotent', async () => {
  const db = getAdminDb();
  const writer = db.bulkWriter();
  for (let i = 0; i < 501; i++) writer.set(db.doc(`posts/post/comments/${i}`), { authorId: uid, content: 'Comment' });
  writer.set(db.doc('posts/post/comments/0/nested/child'), { content: 'Nested descendant' });
  await writer.close();
  const deletion = () => new NextRequest('http://localhost/api/forum/post', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  expect((await deletePost(deletion(), postParams)).status).toBe(200);
  expect((await db.doc('posts/post').get()).exists).toBe(false);
  expect((await db.collection('posts/post/comments').get()).empty).toBe(true);
  expect((await db.doc('posts/post/comments/0/nested/child').get()).exists).toBe(false);
  expect((await db.doc('_forumDeletions/post').get()).get('status')).toBe('complete');
  expect((await deletePost(deletion(), postParams)).status).toBe(200);
});

it('cannot leave a new comment behind when creation races the parent visibility cutover', async () => {
  const deletion = new NextRequest('http://localhost/api/forum/post', { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
  const [created, removed] = await Promise.all([comment(request({ content: 'Racing comment' }), postParams), deletePost(deletion, postParams)]);
  expect([201, 404]).toContain(created.status);
  expect(removed.status).toBe(200);
  expect((await getAdminDb().collection('posts/post/comments').get()).empty).toBe(true);
  expect((await comment(request({ content: 'After deletion' }), postParams)).status).toBe(404);
});

it('creates one validated Arena exam for concurrent retries', async () => {
  const body = { title: 'Exam', config: { subject: 'math', grade: '12', topic: 'Math', type: 'Mixed', difficulty: 'Mixed', numQuestions: '1', timeLimit: '999' }, questions: [question], requestId: crypto.randomUUID() };
  const responses = await Promise.all([createExam(request(body)), createExam(request(body))]);
  expect(responses.map(response => response.status)).toEqual([201, 201]);
  const first = await responses[0].json();
  expect(await responses[1].json()).toEqual(first);
  expect((await getAdminDb().collection('arenaExams').get()).size).toBe(2);
});
