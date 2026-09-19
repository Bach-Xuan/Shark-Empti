// @vitest-environment node
import { buildAiRequest,getAiOperationDefinition } from '@/ai/operation-registry';
import { expect,it,vi } from 'vitest';
import { analysis,question } from './fixtures/quiz';
vi.mock('server-only', () => ({}));

const input = { topic: 'Addition', numQuestions: 1, type: 'Multiple Choice', difficulty: 'Recognition', language: 'en' as const };
it.each([-2.5, 0, 1.5, 51])('rejects count %s before request construction', numQuestions => {
  expect(() => buildAiRequest('generate-questions', { ...input, numQuestions })).toThrow();
});
it('preserves exact-count, question-shape and Arena numeric constraints', () => {
  const regular = buildAiRequest('generate-questions', input).schema;
  expect(regular.safeParse({ questions: [question] }).success).toBe(true);
  expect(regular.safeParse({ questions: [question, question] }).success).toBe(false);
  const arena = buildAiRequest('generate-questions', { ...input, type: 'Short Answer', arenaMode: true }).schema;
  expect(arena.safeParse({ questions: [{ ...question, type: 'Short Answer', options: undefined, correct: 'four' }] }).success).toBe(false);
  expect(arena.safeParse({ questions: [{ ...question, type: 'Short Answer', options: undefined, correct: '-0.25' }] }).success).toBe(true);
});
it('enforces Vietnamese true/false labels and English-subject exception', () => {
  const invalid = buildAiRequest('generate-questions', { ...input, type: 'True/False', language: 'vi' }).schema;
  const output = { questions: [{ ...question, type: 'True/False', options: ['True', 'False'], correct: 'True' }] };
  expect(invalid.safeParse(output).success).toBe(false);
  expect(buildAiRequest('generate-questions', { ...input, type: 'True/False', language: 'vi', subject: 'english' }).schema.safeParse(output).success).toBe(true);
});
it('rejects invalid feedback metrics and empty flashcard content', () => {
  expect(getAiOperationDefinition('personalized-quiz-feedback').outputSchema.safeParse({ ...analysis, topicEn: 'Addition', topicVi: 'Phép cộng', cognitiveMetrics: { ...analysis.cognitiveMetrics, conceptMastery: 101 } }).success).toBe(false);
  expect(buildAiRequest('generate-flashcards', { topic: 'Addition', numCards: 1, language: 'en' }).schema.safeParse({ cards: [{ front: '2+2', back: '   ' }] }).success).toBe(false);
});
