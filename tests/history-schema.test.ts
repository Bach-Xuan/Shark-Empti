import { readHistoryItem } from '@/lib/history-schema';
import { expect,it } from 'vitest';
it('reads legacy omissions without translating or modifying stored content', () => {
  const legacy = { config: { topic: 'Original topic' }, quizResults: [{ question: '2+2?', correct: 4, isCorrect: true }], date: '2026-09-01' };
  const result = readHistoryItem('history', legacy);
  expect(result?.config.topic).toBe('Original topic');
  expect(result?.quizResults[0].correct).toBe('4');
  expect(result?.totalTime).toBe(0);
  expect(legacy.quizResults[0].correct).toBe(4);
});
it('rejects malformed core history without throwing in the dashboard', () => {
  expect(readHistoryItem('broken', { quizResults: null })).toBeNull();
});
