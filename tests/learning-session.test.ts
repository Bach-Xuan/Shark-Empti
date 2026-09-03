import { expect, it } from 'vitest';
import { initialSession, learningSessionReducer } from '@/lib/learning-session';
import type { QuizConfig, QuizHistoryItem } from '@/lib/types';
const config: QuizConfig = { subject: 'Math', grade: '8', topic: 'Equations', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: '1' };
it('starts a fresh session and ignores late completion after reset', () => {
  const started = learningSessionReducer(initialSession, { type: 'start', config, questions: null });
  expect(started.status).toBe('loading');
  const reset = learningSessionReducer(started, { type: 'reset' });
  const results: QuizHistoryItem = { config, quizResults: [], totalTime: 0, date: '', lang: 'en' };
  expect(learningSessionReducer(reset, { type: 'finish', results })).toEqual(initialSession);
});
