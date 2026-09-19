import { buildAiRequest } from '../src/ai/operation-registry';
import { requestStructuredOnce } from '../src/ai/openrouter';

async function smoke(operation: 'generate-questions' | 'ai-coaching-chatbot', input: unknown) {
  const request = buildAiRequest(operation, input);
  const result = await requestStructuredOnce({ operation, modelOrdinal: 0, ...request, signal: new AbortController().signal });
  if (!result.ok) throw new Error(`${operation}: ${result.failure.code}`);
  return result.data;
}
async function main() {
  const quiz = await smoke('generate-questions', { topic: 'Linear equations', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: 1, language: 'en' }) as { questions: Array<{ options?: string[] }> };
  if (quiz.questions.length !== 1 || quiz.questions[0].options?.length !== 4) throw new Error('Invalid quiz contract');
  console.log('Quiz structured-output contract passed.');
  const metrics = { conceptMastery: 100, applicationSkill: 100, problemDecomposition: 100, logicalReasoning: 100, errorAwareness: 100, instructionFollowing: 100 };
  const chat = await smoke('ai-coaching-chatbot', { userMessage: 'How can I improve?', preferredLanguage: 'en', quizQuestions: [], quizSummary: { totalQuestions: 1, correctAnswers: 1, incorrectAnswers: 0, errorAnalysis: {}, cognitiveMetrics: metrics } }) as { aiResponse: string };
  if (!chat.aiResponse.trim()) throw new Error('Empty chatbot reply');
  console.log('OpenRouter quiz and chatbot adapter smoke tests passed.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Smoke test failed'); process.exitCode = 1; });
