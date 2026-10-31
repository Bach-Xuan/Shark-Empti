import { NextRequest } from 'next/server';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { POST as createPost } from '@/app/api/forum/route';
import { PATCH as mutatePost } from '@/app/api/forum/[postId]/route';
import { POST as createReport } from '@/app/api/community/reports/route';
import { GET as queue, POST as moderate } from '@/app/api/community/moderation/route';
import { POST as start } from '@/app/api/arena/[examId]/start/route';
import { POST as submit } from '@/app/api/arena/[examId]/submit/route';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { migrateLegacyArena } from '@/lib/arena-migration';
vi.mock('server-only', () => ({}));
let token: string;
let uid: string;
const postParams = { params: Promise.resolve({ postId: 'post' }) };
const examParams = { params: Promise.resolve({ examId: 'exam' }) };
function request(body: unknown, method = 'POST') {
  return new NextRequest('http://localhost/api/community', { method, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, ...(method === 'GET' ? {} : { body: JSON.stringify(body) }) });
}
beforeAll(async () => {
  const response = await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }) });
  const account = await response.json(); token = account.idToken; uid = account.localId;
  expect(token).toBeTruthy();
});
beforeEach(async () => {
  await fetch(`http://${process.env.FIRESTORE_EMULATOR_HOST}/emulator/v1/projects/demo-shark-empti/databases/(default)/documents`, { method: 'DELETE' });
  await getAdminAuth().setCustomUserClaims(uid, {});
  await getAdminDb().doc('posts/post').set({ title: 'Post', content: 'Body', subject: 'math', authorId: uid, authorName: 'Learner', authorPhoto: '', createdAt: new Date(), likesCount: 0, likedBy: [], commentsCount: 0 });
});

it('caps distinct post creation, while a lost-response replay remains free and creates no duplicate', async () => {
  const input = { title: 'Math', content: 'Hello', subject: 'math', requestId: crypto.randomUUID() };
  const first = await createPost(request(input));
  expect(first.status).toBe(201);
  const identity = await first.json();
  for (let index = 1; index < 10; index++) expect((await createPost(request({ ...input, requestId: crypto.randomUUID() }))).status).toBe(201);
  expect((await createPost(request({ ...input, requestId: crypto.randomUUID() }))).status).toBe(429);
  expect(await (await createPost(request(input))).json()).toEqual(identity);
  expect((await getAdminDb().collection('posts').get()).size).toBe(11);
});
it('validates moved edit boundaries, ignores no ownership, and treats concurrent desired likes idempotently', async () => {
  for (const mutation of [
    { action: 'edit-comment', commentId: '', content: 'x' },
    { action: 'edit-post', title: 'x', content: ' ', subject: 'math' },
    { action: 'edit-post', title: 'x', content: 'x'.repeat(20001), subject: 'math' },
    { action: 'like', liked: true, authorId: 'forged' },
  ]) expect((await mutatePost(request({ requestId: crypto.randomUUID(), mutation }, 'PATCH'), postParams)).status).toBe(400);
  const like = () => mutatePost(request({ requestId: crypto.randomUUID(), mutation: { action: 'like', liked: true } }, 'PATCH'), postParams);
  expect((await Promise.all([like(), like()])).map(response => response.status)).toEqual([200, 200]);
  expect((await getAdminDb().doc('posts/post').get()).get('likesCount')).toBe(1);
  await getAdminDb().doc('posts/post').update({ authorId: 'another-author' });
  expect((await mutatePost(request({ requestId: crypto.randomUUID(), mutation: { action: 'edit-post', title: 'Hijacked', content: 'x', subject: 'math' } }, 'PATCH'), postParams)).status).toBe(403);
});
it('keeps reports private, requires current moderator authority, and supports attributable reversible hiding', async () => {
  const input = { target: { kind: 'post', id: 'post' }, reason: 'Possible spam content', requestId: crypto.randomUUID() };
  const report = await (await createReport(request(input))).json();
  expect(await (await createReport(request(input))).json()).toEqual(report);
  expect((await getAdminDb().collection('_communityReports').get()).size).toBe(1);
  expect((await queue(request(null, 'GET'))).status).toBe(403);
  const decision = { reportId: report.id, reason: 'Confirmed rule violation', requestId: crypto.randomUUID(), action: 'hide' };
  expect((await moderate(request(decision))).status).toBe(403);
  await getAdminAuth().setCustomUserClaims(uid, { moderator: true });
  expect((await queue(request(null, 'GET'))).status).toBe(200);
  expect((await moderate(request(decision))).status).toBe(200);
  expect((await moderate(request(decision))).status).toBe(200);
  expect((await getAdminDb().doc('posts/post').get()).exists).toBe(false);
  expect((await getAdminDb().collection('_moderationActions').get()).size).toBe(1);
  expect((await moderate(request({ ...decision, action: 'restore', requestId: crypto.randomUUID() }))).status).toBe(200);
  expect((await getAdminDb().doc('posts/post').get()).get('content')).toBe('Body');
  expect((await getAdminDb().collection('_moderationArchives').get()).empty).toBe(true);
  await getAdminAuth().setCustomUserClaims(uid, {});
  expect((await queue(request(null, 'GET'))).status).toBe(403); // Old browser token cannot retain a revoked role.
});
it('does not restore a hidden post over an author deletion tombstone', async () => {
  await getAdminAuth().setCustomUserClaims(uid, { moderator: true });
  const report = await (await createReport(request({ target: { kind: 'post', id: 'post' }, reason: 'Review this item', requestId: crypto.randomUUID() }))).json();
  const body = { reportId: report.id, reason: 'Temporarily hidden', requestId: crypto.randomUUID(), action: 'hide' };
  expect((await moderate(request(body))).status).toBe(200);
  await getAdminDb().doc('_forumDeletions/post').set({ authorId: uid, status: 'complete' });
  expect((await moderate(request({ ...body, action: 'restore', requestId: crypto.randomUUID() }))).status).toBe(409);
  expect((await getAdminDb().doc('posts/post').get()).exists).toBe(false);
});
it('migrates legacy answer exposure atomically into non-rewarded practice and never sends a key at start', async () => {
  const db = getAdminDb();
  const questions = [{ question: '2+2?', type: 'Short Answer', correct: '4', explanation: 'Addition', difficulty: 'Easy' }];
  const legacy = { authorId: uid, title: 'Legacy', totalAttempts: 0, createdAt: Timestamp.fromMillis(123456), questions, config: { subject: 'math', grade: '12', topic: 'Math', type: 'Mixed', difficulty: 'Easy', numQuestions: '1' } };
  await db.doc('arenaExams/exam').set(legacy);
  expect((await start(request({ requestId: crypto.randomUUID() }), examParams)).status).toBe(409);
  expect((await migrateLegacyArena(db)).eligible).toBe(1);
  expect((await db.doc('arenaExams/exam').get()).get('questions')).toEqual(questions);
  expect((await migrateLegacyArena(db, true)).migrated).toBe(1);
  expect((await migrateLegacyArena(db, true)).migrated).toBe(0);
  const metadata = (await db.doc('arenaExams/exam').get()).data()!;
  expect(metadata.questions).toBeUndefined(); expect(metadata.practiceOnly).toBe(true);
  expect(metadata.createdAt.toMillis()).toBe(123456);
  expect((await db.doc('_arenaLegacyBackups/exam').get()).get('snapshot')).toEqual(legacy);
  const requestId = crypto.randomUUID();
  const started = await (await start(request({ requestId }), examParams)).json();
  expect(started.questions[0].correct).toBeUndefined(); expect(started.questions[0].explanation).toBeUndefined();
  const result = await (await submit(request({ requestId, answers: ['4'] }), examParams)).json();
  expect(result.coinsAwarded).toBe(0); expect(result.ranked).toBe(false); expect(result.reviewResults[0].isCorrect).toBe(true);
  expect((await db.collection('arenaExams/exam/attempts').get()).empty).toBe(true);
});
it('keeps the first eligible clock across distinct start IDs and excludes self-authored rewards', async () => {
  const db = getAdminDb();
  const config = { subject: 'math', grade: '12', topic: 'Math', type: 'Mixed', difficulty: 'Easy', numQuestions: '1' };
  const questions = [{ question: '2+2?', type: 'Short Answer', correct: '4', explanation: 'Addition', difficulty: 'Easy' }];
  await db.doc('arenaExams/exam').set({ schemaVersion: 2, questionCount: 1, authorId: 'other', title: 'Exam', totalAttempts: 0, config });
  await db.doc('_arenaAnswerKeys/exam').set({ schemaVersion: 2, authorId: 'other', questions });
  const first = await (await start(request({ requestId: crypto.randomUUID() }), examParams)).json();
  const nextId = crypto.randomUUID();
  const next = await (await start(request({ requestId: nextId }), examParams)).json();
  expect(next.startedAtMs).toBe(first.startedAtMs);
  const completed = await submit(request({ requestId: nextId, answers: ['4'] }), examParams);
  expect((await completed.json()).coinsAwarded).toBe(150);
  await db.doc('arenaExams/exam').update({ authorId: uid });
  await db.doc('_arenaAnswerKeys/exam').update({ authorId: uid });
  const selfId = crypto.randomUUID();
  expect((await start(request({ requestId: selfId }), examParams)).status).toBe(200);
  const own = await (await submit(request({ requestId: selfId, answers: ['4'] }), examParams)).json();
  expect(own.coinsAwarded).toBe(0); expect(own.ranked).toBe(false);
  expect((await db.collection('arenaExams/exam/attempts').get()).size).toBe(1);
});
