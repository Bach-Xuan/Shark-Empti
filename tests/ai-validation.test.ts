// @vitest-environment node
import { generateFlashcards } from '@/ai/flows/generate-flashcards-flow';
import { generatePractice } from '@/ai/flows/generate-practice-flow';
import { generateQuestions } from '@/ai/flows/generate-questions-flow';
import { personalizedQuizPerformanceFeedback } from '@/ai/flows/personalized-quiz-feedback-flow';
import { afterEach,expect,it,vi } from 'vitest';
import { analysis,question } from './fixtures/quiz';
vi.mock('server-only', () => ({}));
const input = { topic: 'Addition', numQuestions: 1, type: 'Multiple Choice', difficulty: 'Recognition', language: 'en' as const };
function reply(output: unknown) {
  vi.stubEnv('OPENROUTER_API_KEY', 'fixture-only');
  const request = vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(output) } }] })));
  vi.stubGlobal('fetch', request);
  return request;
}
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
it.each([-2.5, 0, 1.5, 51])('rejects count %s before contacting AI', async numQuestions => {
  const request = reply({ questions: [question] });
  expect(await generateQuestions({ ...input, numQuestions })).toMatchObject({ ok: false, error: { code: 'AI-INVALID-INPUT' } });
  expect(request).not.toHaveBeenCalled();
});
it.each([
  [], [{ ...question, options: undefined }], [{ ...question, options: ['4', '4', '2', '1'] }],
  [{ ...question, correct: '5' }], [{ ...question, type: 'Unknown' }], [question, question],
].map(questions => ({ questions })))('rejects unusable question output after every fallback model rejects it', async ({ questions }) => {
  const request = reply({ questions });
  expect(await generateQuestions(input)).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED', values: { operation: 'generate-questions', attemptedModels: 3, lastFailure: 'AI-INVALID-RESPONSE' } } });
  expect(request).toHaveBeenCalledTimes(3);
});
it('enforces numeric Arena answers while allowing free text in personal quizzes', async () => {
  const free = { ...question, options: undefined, type: 'Short Answer', correct: 'four' };
  reply({ questions: [free] });
  expect(await generateQuestions({ ...input, type: 'Short Answer', arenaMode: true })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
  expect((await generateQuestions({ ...input, type: 'Short Answer' })).ok).toBe(true);
});
it('supports valid mixed types and Vietnamese true/false', async () => {
  const tf = { ...question, type: 'True/False', options: ['Đúng', 'Sai'], correct: 'Đúng' };
  reply({ questions: [question, tf] });
  expect((await generateQuestions({ ...input, type: 'Mixed', numQuestions: 2, language: 'vi' })).ok).toBe(true);
});
it('rejects feedback metrics outside the chatbot contract', async () => {
  reply({ ...analysis, topicEn: 'Addition', topicVi: 'Phép cộng', cognitiveMetrics: { ...analysis.cognitiveMetrics, conceptMastery: 101 } });
  expect(await personalizedQuizPerformanceFeedback({ quizResults: [], originalTopic: 'Addition' })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
});
it.each(['4', '-0.25', '+12.5', '.5'])('accepts numeric Arena answer %s', async correct => {
  reply({ questions: [{ ...question, type: 'Short Answer', options: undefined, correct }] });
  expect((await generateQuestions({ ...input, type: 'Short Answer', arenaMode: true })).ok).toBe(true);
});
it('validates practice options and exact counts, and nonempty flashcards', async () => {
  reply({ questions: [{ ...question, options: ['4', '3'] }] });
  expect(await generatePractice({ concept: 'Addition', numQuestions: 1, language: 'en' })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
  reply({ cards: [{ front: '2+2', back: '   ' }] });
  expect(await generateFlashcards({ topic: 'Addition', numCards: 1, language: 'en' })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
  reply({ cards: [{ front: '2+2', back: '4' }] });
  expect(await generateFlashcards({ topic: 'Addition', numCards: 2, language: 'en' })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
});
it('enforces Vietnamese true/false labels but retains the English subject exception', async () => {
  reply({ questions: [{ ...question, type: 'True/False', options: ['True', 'False'], correct: 'True' }] });
  expect(await generateQuestions({ ...input, type: 'True/False', language: 'vi' })).toMatchObject({ ok: false, error: { code: 'AI-FALLBACK-EXHAUSTED' } });
  expect((await generateQuestions({ ...input, type: 'True/False', language: 'vi', subject: 'english' })).ok).toBe(true);
});
