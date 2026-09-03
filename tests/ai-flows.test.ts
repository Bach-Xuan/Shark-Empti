// @vitest-environment node
import { afterEach, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { generateQuestions } from '@/ai/flows/generate-questions-flow';
import { generatePractice } from '@/ai/flows/generate-practice-flow';
import { generateFlashcards } from '@/ai/flows/generate-flashcards-flow';
import { shortAnswerAnalysis } from '@/ai/flows/short-answer-analysis-flow';
import { validateAcademicTopic } from '@/ai/flows/academic-validation-flow';
import { personalizedQuizPerformanceFeedback } from '@/ai/flows/personalized-quiz-feedback-flow';
import { aiCoachingChatbotForQuizReview } from '@/ai/flows/ai-coaching-chatbot-flow';
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
const question = { question: '2 + 2?', section: 'Addition', type: 'Short Answer', difficulty: 'Easy', correct: '4', explanation: 'Two plus two equals four.' };
const metrics = { conceptMastery: 100, applicationSkill: 100, problemDecomposition: 100, logicalReasoning: 100, errorAwareness: 100, instructionFollowing: 100 };
const cases = [
  { name: 'numeric Arena', run: () => generateQuestions({ topic: 'Addition', type: 'Short Answer', difficulty: 'Easy', numQuestions: 1, language: 'en', arenaMode: true }), output: { questions: [question] } },
  { name: 'practice', run: () => generatePractice({ concept: 'Addition', numQuestions: 1, language: 'en' }), output: { questions: [question] } },
  { name: 'flashcards', run: () => generateFlashcards({ topic: 'Addition', numCards: 1, language: 'vi' }), output: { cards: [{ front: '2 + 2?', back: 'Bằng bốn.' }] } },
  { name: 'short answer', run: () => shortAnswerAnalysis({ questionText: '2 + 2?', correctAnswer: '4', userAnswer: '4', language: 'vi' }), output: { isCorrect: true, feedback: 'Chính xác.', confidence: 1 } },
  { name: 'topic validation', run: () => validateAcademicTopic({ topic: 'Addition', language: 'vi' }), output: { isValid: true, reason: '' } },
  { name: 'bilingual feedback', run: () => personalizedQuizPerformanceFeedback({ quizResults: [], originalTopic: 'Addition' }), output: { topicEn: 'Addition', topicVi: 'Phép cộng', en: { strengths: [], weaknesses: [], recommendations: [] }, vi: { strengths: [], weaknesses: [], recommendations: [] }, errorCategories: {}, cognitiveMetrics: metrics } },
  { name: 'chat review', run: () => aiCoachingChatbotForQuizReview({ userMessage: 'Help', preferredLanguage: 'vi', quizQuestions: [], quizSummary: { totalQuestions: 1, correctAnswers: 1, incorrectAnswers: 0, cognitiveMetrics: metrics, errorAnalysis: {} }, chatHistory: [{ role: 'model', message: 'Earlier advice' }] }), output: { aiResponse: 'Hãy luyện tập phép cộng.' } },
];
for (const scenario of cases) it(`${scenario.name} preserves its public result contract through the OpenRouter adapter`, async () => {
  vi.stubEnv('OPENROUTER_API_KEY', 'test-only');
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(scenario.output) } }] })));
  vi.stubGlobal('fetch', fetchMock);
  const result = await scenario.run();
  expect(result.ok).toBe(true);
  const body = JSON.parse(fetchMock.mock.calls[0][1].body);
  expect(body.messages[0].role).toBe('system');
  if (scenario.name === 'chat review') {
    expect(body.messages[1].role).toBe('assistant');
    expect(body.messages.at(-1).content).toContain('instructionFollowing');
  }
});
