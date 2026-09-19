// @vitest-environment node
import { buildAiRequest,getAiOperationDefinition } from '@/ai/operation-registry';
import { AI_OPERATIONS } from '@/ai/protocol';
import { expect,it,vi } from 'vitest';
vi.mock('server-only', () => ({}));

const metrics = { conceptMastery: 100, applicationSkill: 100, problemDecomposition: 100, logicalReasoning: 100, errorAwareness: 100, instructionFollowing: 100 };
const inputs = {
  'academic-validation': { topic: 'Addition', language: 'vi' },
  'generate-questions': { topic: 'Addition', type: 'Short Answer', difficulty: 'Easy', numQuestions: 1, language: 'en', arenaMode: true },
  'generate-flashcards': { topic: 'Addition', numCards: 1, language: 'vi' },
  'generate-practice': { concept: 'Addition', numQuestions: 1, language: 'en' },
  'short-answer-analysis': { questionText: '2 + 2?', correctAnswer: '4', userAnswer: '4', language: 'vi' },
  'personalized-quiz-feedback': { quizResults: [], originalTopic: 'Addition' },
  'ai-coaching-chatbot': { userMessage: 'Help', preferredLanguage: 'vi', quizQuestions: [], quizSummary: { totalQuestions: 1, correctAnswers: 1, incorrectAnswers: 0, cognitiveMetrics: metrics, errorAnalysis: {} }, chatHistory: [{ role: 'model', message: 'Earlier advice' }] },
} as const;

it('registers all seven operations with bounded inputs and positive quota weights', () => {
  expect(AI_OPERATIONS).toHaveLength(7);
  for (const operation of AI_OPERATIONS) {
    const definition = getAiOperationDefinition(operation);
    expect(definition.costWeight).toBeGreaterThan(0);
    expect(definition.inputLimits.maxSerializedBytes).toBeGreaterThan(0);
    const built = buildAiRequest(operation, inputs[operation]);
    expect(built.system.length).toBeGreaterThan(20);
    expect(built.prompt.length).toBeGreaterThan(0);
  }
});

it('represents chatbot history once and leaves model selection outside the operation', () => {
  const built = buildAiRequest('ai-coaching-chatbot', inputs['ai-coaching-chatbot']);
  expect(built.messages?.map(message => message.role)).toEqual(['assistant']);
  expect(JSON.stringify(built).split('Earlier advice')).toHaveLength(2);
  expect(built).not.toHaveProperty('model');
});
