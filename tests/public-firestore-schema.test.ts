import { describe, expect, it } from 'vitest';
import { readArenaAttempt, readArenaExam, readForumComment, readForumPost } from '@/lib/public-firestore-schema';

const post = { authorId: 'owner', title: 'Title', content: 'Body', subject: 'math' };
const config = { subject: 'math', grade: '12', topic: 'Algebra', type: 'Mixed', difficulty: 'Mixed', numQuestions: '1' };
const question = { question: '2+2?', type: 'Multiple Choice', correct: '4', options: ['1', '2', '3', '4'], explanation: 'Addition.' };
const exam = { authorId: 'owner', title: 'Algebra', config, questions: [question] };

describe('public persisted record readers', () => {
  it('uses snapshot identity and defaults only safe legacy presentation fields', () => {
    expect(readForumPost('real', { ...post, id: 'forged' })).toMatchObject({ id: 'real', authorName: 'Learner', authorPhoto: '', createdAt: null, likesCount: 0, commentsCount: 0, likedBy: [] });
    expect(readArenaExam('real', { ...exam, id: 'forged' })).toMatchObject({ id: 'real', totalAttempts: 0, questions: [{ difficulty: 'Mixed' }] });
    expect(readForumComment('real', { authorId: 'owner', content: 'Hello' })?.authorName).toBe('Learner');
  });
  it.each(['authorId', 'title', 'content', 'subject'])('rejects missing post core field %s', key => {
    const data: Record<string, unknown> = { ...post }; delete data[key];
    expect(readForumPost('id', data)).toBeNull();
  });
  it.each(['authorId', 'title', 'config', 'questions'])('rejects missing exam core field %s', key => {
    const data: Record<string, unknown> = { ...exam }; delete data[key];
    expect(readArenaExam('id', data)).toBeNull();
  });
  it.each(['subject', 'grade', 'topic', 'type', 'difficulty', 'numQuestions'])('rejects missing config field %s', key => {
    const data: Record<string, unknown> = { ...config }; delete data[key];
    expect(readArenaExam('id', { ...exam, config: data })).toBeNull();
  });
  it.each(['question', 'type', 'correct', 'explanation'])('rejects missing question core field %s', key => {
    const data: Record<string, unknown> = { ...question }; delete data[key];
    expect(readArenaExam('id', { ...exam, questions: [data] })).toBeNull();
  });
  it.each([null, [], 'invalid', 1, { ...post, authorName: {} }, { ...post, title: [] }, { ...post, likesCount: NaN }, { ...post, commentsCount: -1 }, { ...post, likedBy: [8] }, { ...post, likesCount: 1, likedBy: [] }, { ...post, likesCount: 2, likedBy: ['a', 'a'] }, { ...post, authorPhoto: 'javascript:alert(1)' }])('rejects corrupt forum record %#', data => {
    expect(readForumPost('id', data)).toBeNull();
  });
  it('does not throw on malformed dates and accepts actual SDK timestamp shapes', () => {
    expect(readForumPost('id', { ...post, createdAt: { toDate() { throw Error('broken'); } } })?.createdAt).toBeNull();
    expect(readForumPost('id', { ...post, createdAt: { toDate: () => new Date(123) } })?.createdAt).toEqual(new Date(123));
  });
  it.each([
    { ...exam, config: null }, { ...exam, questions: [] }, { ...exam, questions: [null] },
    { ...exam, questions: [{ ...question, options: ['4', '4', '3', '2'] }] },
    { ...exam, questions: [{ ...question, correct: 'missing' }] },
    { ...exam, questions: [{ ...question, type: 'unknown' }] },
    { ...exam, questions: [{ ...question, type: 'Short Answer', options: [], correct: '4 kg' }] },
    { ...exam, config: { ...config, numQuestions: '2' } },
    { ...exam, config: { ...config, timeLimit: 'NaN' } },
    { ...exam, totalAttempts: Infinity },
  ])('rejects unscorable exam %#', data => expect(readArenaExam('id', data)).toBeNull());
  it('validates every question, including the last of a maximum-size exam', () => {
    const questions = Array.from({ length: 50 }, () => question);
    const data = { ...exam, config: { ...config, numQuestions: 50 }, questions };
    expect(readArenaExam('id', data)?.questions).toHaveLength(50);
    expect(readArenaExam('id', { ...data, questions: [...questions.slice(0, 49), { ...question, correct: null }] })).toBeNull();
  });
  it('accepts historical UI timer limits through 999 minutes and rejects unbounded values', () => {
    expect(readArenaExam('id', { ...exam, config: { ...config, timeLimit: '999' } })?.config.timeLimit).toBe('999');
    expect(readArenaExam('id', { ...exam, config: { ...config, timeLimit: '1000' } })).toBeNull();
  });
  it('validates leaderboard identity, score and duration', () => {
    const attempt = { examId: 'exam', userId: 'owner', score: 100, duration: 10 };
    expect(readArenaAttempt('id', { ...attempt, id: 'forged' })).toMatchObject({ id: 'id', userName: 'Learner' });
    for (const key of ['examId', 'userId', 'score', 'duration']) {
      const data: Record<string, unknown> = { ...attempt }; delete data[key];
      expect(readArenaAttempt('id', data)).toBeNull();
    }
    expect(readArenaAttempt('id', { ...attempt, score: 101 })).toBeNull();
    expect(readArenaAttempt('id', { ...attempt, duration: -1 })).toBeNull();
    expect(readArenaAttempt('id', { ...attempt, userName: [] })).toBeNull();
  });
});
