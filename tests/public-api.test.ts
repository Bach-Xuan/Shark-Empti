// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { POST as createExam } from '@/app/api/arena/route';
import { POST as submitExam } from '@/app/api/arena/[examId]/submit/route';
import { POST as createComment, DELETE as deleteComment } from '@/app/api/forum/[postId]/comments/route';
import { DELETE as deletePost } from '@/app/api/forum/[postId]/route';
import { readLimitedJson } from '@/lib/server-json';

vi.mock('server-only', () => ({}));
type Row = Record<string, unknown>;
const mocks = vi.hoisted(() => ({ getDb: vi.fn(), getAuth: vi.fn(), cascade: vi.fn() }));
vi.mock('@/lib/firebase-admin', () => ({ getAdminDb: mocks.getDb, getAdminAuth: mocks.getAuth, AdminConfigurationError: class extends Error {} }));
const rows = new Map<string, Row>();
let generated = 0;
function reference(path: string) {
  return { path, id: path.split('/').at(-1)!, collection: (name: string) => collection(`${path}/${name}`),
    update: async (data: Row) => { rows.set(path, { ...rows.get(path), ...data }); },
  };
}
function collection(path: string) { return { doc: (id = `generated-${++generated}`) => reference(`${path}/${id}`) }; }
type Ref = ReturnType<typeof reference>;
const db = {
  collection,
  recursiveDelete: mocks.cascade,
  runTransaction: async (callback: (tx: unknown) => Promise<unknown>) => {
    const writes: (() => void)[] = [];
    const result = await callback({
      get: async (ref: Ref) => ({ exists: rows.has(ref.path), data: () => rows.get(ref.path), get: (key: string) => rows.get(ref.path)?.[key] }),
      create: (ref: Ref, data: Row) => writes.push(() => { if (rows.has(ref.path)) throw Error('already exists'); rows.set(ref.path, data); }),
      update: (ref: Ref, data: Row) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...data })),
      set: (ref: Ref, data: Row) => writes.push(() => rows.set(ref.path, { ...rows.get(ref.path), ...data })),
      delete: (ref: Ref) => writes.push(() => rows.delete(ref.path)),
    });
    writes.forEach(write => write()); return result;
  },
};
const config = { subject: 'math', grade: '12', topic: 'Algebra', type: 'Mixed', difficulty: 'Mixed', numQuestions: '1', timeLimit: '999' };
const question = { question: '2+2?', type: 'Short Answer', correct: '4', explanation: 'Addition' };
const post = { authorId: 'owner', title: 'Post', content: 'Body', subject: 'math', commentsCount: 0 };
const postParams = { params: Promise.resolve({ postId: 'post' }) };
const examParams = { params: Promise.resolve({ examId: 'exam' }) };
function request(body: unknown, method = 'POST', token = 'owner', path = '/') {
  return new NextRequest(`http://localhost${path}`, { method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(method === 'POST' ? { body: JSON.stringify(body) } : {}),
  });
}
beforeEach(() => {
  vi.clearAllMocks(); rows.clear(); generated = 0;
  mocks.getDb.mockReturnValue(db);
  mocks.getAuth.mockReturnValue({ verifyIdToken: async (uid: string) => { if (uid === 'invalid') throw Error('private reason'); return { uid }; }, getUser: async () => ({ displayName: 'Learner', photoURL: '' }) });
  mocks.cascade.mockImplementation(async (ref: Ref) => {
    for (const key of rows.keys()) if (key === ref.path || key.startsWith(`${ref.path}/`)) rows.delete(key);
  });
  rows.set('posts/post', { ...post });
  rows.set('arenaExams/exam', { authorId: 'owner', title: 'Exam', config, questions: [question], totalAttempts: 0 });
});

describe('public server boundaries', () => {
  it('authenticates before parsing or accessing persistence', async () => {
    expect((await createExam(request(null, 'POST', ''))).status).toBe(401);
    expect((await deletePost(request(null, 'DELETE', 'invalid'), postParams)).status).toBe(401);
    expect(mocks.getDb).not.toHaveBeenCalled();
  });
  it('validates complete exams, preserves 999-minute timer, ignores forged authority, and deduplicates retries', async () => {
    const input = { title: 'Exam', config, questions: [question], requestId: crypto.randomUUID() };
    const first = await createExam(request(input));
    expect(first.status).toBe(201);
    const result = await first.json();
    expect(rows.get(`arenaExams/${result.id}`)).toMatchObject({ authorId: 'owner', totalAttempts: 0, config: { timeLimit: '999' } });
    expect(await (await createExam(request(input))).json()).toEqual(result);
    expect((await createExam(request({ ...input, title: 'Different' }))).status).toBe(409);
    expect((await createExam(request({ ...input, authorId: 'attacker' }))).status).toBe(400);
    expect([...rows.keys()].filter(key => key.startsWith('arenaExams/'))).toHaveLength(2);
  });
  it.each([
    { config: {} }, { questions: [null] }, { questions: [{ ...question, correct: 'four' }] },
    { questions: [{ ...question, type: 'Multiple Choice', options: ['1', '2', '3', '4'], correct: '5' }] },
    { config: { ...config, numQuestions: '2' } },
  ])('rejects invalid exam writes without creating records %#', async patch => {
    const response = await createExam(request({ title: 'Exam', config, questions: [question], requestId: crypto.randomUUID(), ...patch }));
    expect(response.status).toBe(400);
    expect([...rows.keys()].filter(key => key.startsWith('arenaExams/'))).toEqual(['arenaExams/exam']);
  });
  it('rejects corrupt persisted exam before scoring, counter updates, or rewards', async () => {
    rows.set('arenaExams/exam', { authorId: 'owner', questions: [null], totalAttempts: 'bad' });
    expect((await submitExam(request({ answers: ['4'] }), examParams)).status).toBe(409);
    expect([...rows.keys()]).toEqual(['posts/post', 'arenaExams/exam']);
  });
  it('rejects corrupt parents before comment creation or deletion and handles absent parents', async () => {
    rows.set('posts/post', { ...post, commentsCount: NaN });
    rows.set('posts/post/comments/comment', { authorId: 'owner' });
    expect((await createComment(request({ content: 'Hello' }), postParams)).status).toBe(409);
    expect((await deleteComment(request(null, 'DELETE', 'owner', '/?commentId=comment'), postParams)).status).toBe(409);
    expect(rows.has('posts/post/comments/comment')).toBe(true);
    rows.delete('posts/post');
    expect((await createComment(request({ content: 'Hello' }), postParams)).status).toBe(404);
  });
  it('creates valid legacy-parent comments exactly once and updates the count', async () => {
    const input = { content: 'Hello', requestId: crypto.randomUUID() };
    expect((await createComment(request(input), postParams)).status).toBe(201);
    expect((await createComment(request(input), postParams)).status).toBe(201);
    expect(rows.get('posts/post')?.commentsCount).toBe(1);
    expect([...rows.keys()].filter(key => key.startsWith('posts/post/comments/'))).toHaveLength(1);
  });
  it.each(['pending', 'complete'])('rejects comment mutation if an admin restored a tombstoned parent (%s)', async status => {
    rows.set('_forumDeletions/post', { authorId: 'owner', status });
    rows.set('posts/post/comments/comment', { authorId: 'owner' });
    expect((await createComment(request({ content: 'Restored parent' }), postParams)).status).toBe(404);
    expect((await deleteComment(request(null, 'DELETE', 'owner', '/?commentId=comment'), postParams)).status).toBe(404);
    expect(rows.get('posts/post')?.commentsCount).toBe(0);
    expect(rows.has('posts/post/comments/comment')).toBe(true);
  });
  it('bounds streamed JSON by bytes without trusting content-length', async () => {
    const req = new Request('http://localhost', { method: 'POST', body: JSON.stringify('é'.repeat(10)) });
    await expect(readLimitedJson(req, 12)).rejects.toMatchObject({ status: 413 });
    expect((await createExam(request({ payload: 'x'.repeat(900_001) }))).status).toBe(413);
    expect((await createComment(request({ content: 'x'.repeat(16_385) }), postParams)).status).toBe(413);
  });
});

describe('recoverable post deletion', () => {
  it('rejects nonowners before hiding or cascading', async () => {
    expect((await deletePost(request(null, 'DELETE', 'other'), postParams)).status).toBe(403);
    expect(rows.has('posts/post')).toBe(true);
    expect(rows.has('_forumDeletions/post')).toBe(false);
    expect(mocks.cascade).not.toHaveBeenCalled();
  });
  it('deletes more than one batch and nested descendants; completed owner retry is idempotent', async () => {
    for (let i = 0; i < 501; i++) rows.set(`posts/post/comments/${i}`, { content: 'comment' });
    rows.set('posts/post/comments/0/nested/child', { content: 'nested' });
    expect((await deletePost(request(null, 'DELETE'), postParams)).status).toBe(200);
    expect([...rows.keys()].filter(key => key.startsWith('posts/'))).toEqual([]);
    expect(rows.get('_forumDeletions/post')).toMatchObject({ authorId: 'owner', status: 'complete' });
    expect((await deletePost(request(null, 'DELETE'), postParams)).status).toBe(200);
    expect(mocks.cascade).toHaveBeenCalledTimes(1);
    expect((await deletePost(request(null, 'DELETE', 'other'), postParams)).status).toBe(403);
  });
  it('retains owner recovery authority on partial failure, blocks new comments, and resumes on retry', async () => {
    rows.set('posts/post/comments/leftover', { content: 'comment' });
    mocks.cascade.mockRejectedValueOnce(Error('private SDK details'));
    const response = await deletePost(request(null, 'DELETE'), postParams);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('private');
    expect(rows.has('posts/post')).toBe(false);
    expect(rows.get('_forumDeletions/post')).toMatchObject({ status: 'pending', authorId: 'owner' });
    expect((await createComment(request({ content: 'Too late' }), postParams)).status).toBe(404);
    expect((await deletePost(request(null, 'DELETE', 'other'), postParams)).status).toBe(403);
    expect((await deletePost(request(null, 'DELETE'), postParams)).status).toBe(200);
    expect(rows.has('posts/post/comments/leftover')).toBe(false);
  });
  it('allows deletion of corrupt owned parents but does not invent ownership for old orphans', async () => {
    rows.set('posts/post', { authorId: 'owner', title: [] });
    expect((await deletePost(request(null, 'DELETE'), postParams)).status).toBe(200);
    rows.delete('_forumDeletions/post');
    expect((await deletePost(request(null, 'DELETE'), postParams)).status).toBe(404);
  });
});
