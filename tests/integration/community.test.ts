import { NextRequest } from 'next/server';
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';
import { beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { seedServiceConsent } from '../fixtures/service-consent';
import { POST as createPost } from '@/app/api/forum/route';
import { PATCH as mutatePost, DELETE as deletePost } from '@/app/api/forum/[postId]/route';
import { POST as createComment, DELETE as deleteComment } from '@/app/api/forum/[postId]/comments/route';
import { POST as createExam } from '@/app/api/arena/route';
import { POST as createReport } from '@/app/api/community/reports/route';
import { GET as queue, POST as moderate } from '@/app/api/community/moderation/route';
import { POST as start } from '@/app/api/arena/[examId]/start/route';
import { POST as submit } from '@/app/api/arena/[examId]/submit/route';
import { getAdminAuth, getAdminDb } from '@/lib/firebase-admin';
import { migrateLegacyArena } from '@/lib/arena-migration';
import { forumReactionId } from '@/lib/community-privacy';
import { projectForumMetadata } from '@/lib/community-projections';
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
  await seedServiceConsent(uid);
  await getAdminDb().doc('posts/post').set({ title: 'Post', content: 'Body', subject: 'math', authorId: uid, authorName: 'Learner', authorPhoto: '', createdAt: new Date(), likesCount: 0, likedBy: [], commentsCount: 0 });
  await getAdminDb().doc('forumPosts/post').set(projectForumMetadata((await getAdminDb().doc('posts/post').get()).data(), 'post')!);
});

it.each([undefined, 'comment'])('keeps own reaction state atomic with the %s target and replay', async commentId => {
  const db = getAdminDb(), target = { postId: 'post', ...(commentId ? { commentId } : {}) };
  if (commentId) {
    const comment = { content: 'Comment', authorId: uid, likesCount: 0, likedBy: [] };
    await db.doc('posts/post/comments/comment').set(comment);
    await db.doc('forumPosts/post/comments/comment').set(projectForumMetadata(comment, 'comment')!);
  }
  const ref = db.doc('posts/post' + (commentId ? '/comments/comment' : ''));
  const publicRef = db.doc('forumPosts/post' + (commentId ? '/comments/comment' : ''));
  const own = db.doc('users/' + uid + '/forumReactions/' + await forumReactionId(target));
  const requestId = crypto.randomUUID(), body = { requestId, mutation: { action: 'like', liked: true, ...(commentId ? { commentId } : {}) } };
  expect((await mutatePost(request(body, 'PATCH'), postParams)).status).toBe(200);
  expect((await own.get()).data()).toMatchObject({ ...target, liked: true, privacyVersion: 1 });
  expect((await ref.get()).get('likedBy')).toEqual([uid]);
  expect((await publicRef.get()).get('likesCount')).toBe(1);
  expect((await publicRef.get()).get('likedBy')).toBeUndefined();
  expect((await mutatePost(request(body, 'PATCH'), postParams)).status).toBe(200);
  expect((await ref.get()).get('likesCount')).toBe(1);
  expect((await mutatePost(request({ requestId: crypto.randomUUID(), mutation: { ...body.mutation, liked: false } }, 'PATCH'), postParams)).status).toBe(200);
  expect((await own.get()).exists).toBe(false);
  expect((await ref.get()).get('likesCount')).toBe(0);
  expect((await publicRef.get()).get('likesCount')).toBe(0);
});

it('repairs missing own state on an unchanged legacy like and preserves a conflicting private record', async () => {
  const db = getAdminDb(), own = db.doc('users/' + uid + '/forumReactions/' + await forumReactionId({ postId: 'post' }));
  await db.doc('posts/post').update({ likedBy: [uid], likesCount: 1 });
  const like = () => request({ requestId: crypto.randomUUID(), mutation: { action: 'like', liked: true } }, 'PATCH');
  expect((await mutatePost(like(), postParams)).status).toBe(200);
  expect((await own.get()).get('liked')).toBe(true);
  await own.set({ privateLegacyNote: 'preserve' });
  expect((await mutatePost(like(), postParams)).status).toBe(409);
  expect((await own.get()).data()).toEqual({ privateLegacyNote: 'preserve' });
  expect((await db.doc('posts/post').get()).get('likesCount')).toBe(1);
});

it('does not write own state when a business reaction reservation is denied', async () => {
  const db = getAdminDb();
  await db.doc('_requestBudgets/community-mutate_global').set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  expect((await mutatePost(request({ requestId: crypto.randomUUID(), mutation: { action: 'like', liked: true } }, 'PATCH'), postParams)).status).toBe(429);
  expect((await db.collection('users/' + uid + '/forumReactions').get()).empty).toBe(true);
  expect((await db.doc('posts/post').get()).get('likesCount')).toBe(0);
});

it.each(['post', 'edit', 'delete-post', 'comment', 'delete-comment', 'report', 'exam', 'start', 'submit'])('admits %s traffic before malformed input or missing-resource reads', async operation => {
  const db = getAdminDb();
  await db.doc('_requestBudgets/community-traffic_global').set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  const missingPost = { params: Promise.resolve({ postId: 'missing' }) }, missingExam = { params: Promise.resolve({ examId: 'missing' }) };
  const routes: Record<string, () => Promise<Response>> = {
    post: () => createPost(request({})), edit: () => mutatePost(request({}, 'PATCH'), missingPost),
    'delete-post': () => deletePost(request(undefined, 'DELETE'), missingPost),
    comment: () => createComment(request({}), missingPost), 'delete-comment': () => deleteComment(request(undefined, 'DELETE'), missingPost),
    report: () => createReport(request({})), exam: () => createExam(request({})),
    start: () => start(request({ requestId: crypto.randomUUID() }), missingExam),
    submit: () => submit(request({ requestId: crypto.randomUUID(), answers: [] }), missingExam),
  };
  expect((await routes[operation]()).status).toBe(429);
  expect((await db.doc('posts/post').get()).exists).toBe(true);
  expect((await db.collection('_requestReceipts').get()).empty).toBe(true);
});
it.each(['queue', 'moderate'])('admits moderator %s traffic before role or query/body work', async operation => {
  await getAdminDb().doc('_requestBudgets/moderation-traffic_global').set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  const response = operation === 'queue' ? await queue(request(null, 'GET')) : await moderate(request({}));
  expect(response.status).toBe(429);
});
it('charges malformed input and replay to traffic while reserving business quota only once', async () => {
  const db = getAdminDb(), owner = createHash('sha256').update(uid).digest('hex');
  const user = db.doc('_requestBudgets/community-traffic_user_' + owner), global = db.doc('_requestBudgets/community-traffic_global');
  await user.set({ tokens: 180, updatedAtMs: Date.now() + 60000 });
  await global.set({ tokens: 1800, updatedAtMs: Date.now() + 60000 });
  expect((await createPost(request({}))).status).toBe(400);
  const business = db.doc('_requestBudgets/post-create_user_' + owner);
  expect((await business.get()).exists).toBe(false);
  const input = { title: 'Math', content: 'Body', subject: 'math', requestId: crypto.randomUUID() };
  const created = await createPost(request(input));
  expect(created.status).toBe(201);
  const first = await created.json(), reserved = (await business.get()).data();
  const replay = await createPost(request(input));
  expect(replay.status).toBe(201);
  expect(await replay.json()).toEqual(first);
  expect((await business.get()).data()).toEqual(reserved);
  expect((await user.get()).get('tokens')).toBe(177);
  expect((await global.get()).get('tokens')).toBe(1797);
});
it('admits only the final global traffic token under concurrent callers from different owners', async () => {
  const account = await (await fetch(`http://${process.env.FIREBASE_AUTH_EMULATOR_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=test`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }),
  })).json();
  await seedServiceConsent(account.localId);
  const db = getAdminDb();
  await db.doc('_requestBudgets/community-traffic_global').set({ tokens: 1, updatedAtMs: Date.now() + 60000 });
  const other = new NextRequest('http://localhost/api/forum', { method: 'POST', headers: { Authorization: 'Bearer ' + account.idToken }, body: '{}' });
  const responses = await Promise.all([createPost(request({})), createPost(other)]);
  expect(responses.map(response => response.status).sort()).toEqual([400, 429]);
  expect((await db.collection('_requestReceipts').get()).empty).toBe(true);
  const buckets = await db.collection('_requestBudgets').get();
  expect(buckets.size).toBe(2); // One admitted owner's bucket and the shared bucket.
});

it('caps distinct post creation, while a lost-response replay consumes no extra business quota or duplicate', async () => {
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

it('keeps new open reports visible behind old hidden reports and pages tied timestamps without a cursor lookup', async () => {
  const db = getAdminDb();
  await getAdminAuth().setCustomUserClaims(uid, { moderator: true });
  const batch = db.batch();
  for (const [status, count, instant] of [['hidden', 55, 1], ['open', 52, 2]] as const) {
    for (let index = 0; index < count; index++) batch.set(db.collection('_communityReports').doc(status + '-' + String(index).padStart(3, '0')), {
      status, createdAt: Timestamp.fromMillis(instant), reason: 'Review this content', target: { kind: 'post', id: 'post' }, reporterId: uid,
    });
  }
  await batch.commit();
  const read = (search = '') => queue(new NextRequest('http://localhost/api/community/moderation' + search, {
    headers: { Authorization: `Bearer ${token}` },
  }));
  const first = await (await read()).json();
  expect(first.reports).toHaveLength(50);
  expect(first.reports.every((report: { status: string }) => report.status === 'open')).toBe(true);
  expect(first.reports[0].id).toBe('open-000');
  expect(first.reports.at(-1).id).toBe('open-049');
  await db.doc('_communityReports/open-049').delete();
  const second = await (await read('?after=' + first.nextCursor)).json();
  expect(second.reports.map((report: { id: string }) => report.id)).toEqual(['open-050', 'open-051']);
  expect(second.nextCursor).toBeNull();
  const hidden = await (await read('?status=hidden')).json();
  expect(hidden.reports).toHaveLength(50);
  const lastHidden = await (await read('?status=hidden&after=' + hidden.nextCursor)).json();
  expect(lastHidden.reports).toHaveLength(5);
  expect(lastHidden.nextCursor).toBeNull();
  expect((await read('?status=hidden&after=' + first.nextCursor)).status).toBe(400);
  expect((await read('?after=invalid')).status).toBe(400);
  expect((await read('?status=unknown')).status).toBe(400);
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
