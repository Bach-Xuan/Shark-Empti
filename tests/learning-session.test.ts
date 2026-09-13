import { initialSession,learningSessionReducer } from '@/lib/learning-session';
import type { QuizConfig,QuizHistoryItem } from '@/lib/types';
import { expect,it } from 'vitest';
const config: QuizConfig = { subject: 'Math', grade: '8', topic: 'Equations', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: '1' };
it('starts a fresh session and ignores late completion after reset', () => {
  const started = learningSessionReducer(initialSession, { type: 'start', config, questions: null });
  expect(started.status).toBe('loading');
  const reset = learningSessionReducer(started, { type: 'reset' });
  const results: QuizHistoryItem = { config, quizResults: [], totalTime: 0, date: '', lang: 'en' };
  expect(learningSessionReducer(reset, { type: 'finish', results })).toEqual(initialSession);
});

it('owns ready and result transitions and ignores ready after finish or reset', () => {
 const started = learningSessionReducer(initialSession, { type: 'start', config, questions: null });
 const ready = learningSessionReducer(started, { type: 'ready', questions: [] });
 expect(ready.status).toBe('quiz');
 const result: QuizHistoryItem = { config, quizResults: [], totalTime: 1, date: '', lang: 'en' };
 const finished = learningSessionReducer(ready, { type: 'finish', results: result });
 expect(finished.status).toBe('result');
 expect(learningSessionReducer(finished, { type: 'ready', questions: [] })).toBe(finished);
 expect(learningSessionReducer(initialSession, { type: 'ready', questions: [] })).toBe(initialSession);
});
