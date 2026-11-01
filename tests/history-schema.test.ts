import { readHistoryItem } from '@/lib/history-schema';
import { expect,it } from 'vitest';
import { history, analysis } from './fixtures/quiz';
it('retains valid legacy analysis that exceeds new-write bounds without rewriting it', () => {
  const legacy = { ...history, analysis: { ...analysis, en: { ...analysis.en, recommendations: Array.from({ length: 51 }, () => 'x'.repeat(20001)), legacyLabel: 'Retain' } } };
  expect(readHistoryItem('legacy', legacy)?.analysis?.en.recommendations).toEqual(legacy.analysis.en.recommendations);
  expect(legacy.analysis.en.legacyLabel).toBe('Retain');
});
it('reads legacy omissions without translating or modifying stored content', () => {
  const legacy = { config: { topic: 'Original topic' }, quizResults: [{ question: '2+2?', correct: 4, isCorrect: true }], date: '2026-09-01T00:00:00.000Z' };
  const result = readHistoryItem('history', legacy);
  expect(result?.config.topic).toBe('Original topic');
  expect(result?.quizResults[0].correct).toBe('4');
  expect(result?.totalTime).toBe(0);
  expect(legacy.quizResults[0].correct).toBe(4);
});
it('rejects malformed core history without throwing in the dashboard', () => {
  expect(readHistoryItem('broken', { quizResults: null })).toBeNull();
});
