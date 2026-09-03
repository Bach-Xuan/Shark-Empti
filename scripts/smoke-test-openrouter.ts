import { generateQuestions } from '../src/ai/flows/generate-questions-flow';
import { aiCoachingChatbotForQuizReview } from '../src/ai/flows/ai-coaching-chatbot-flow';

async function main() {
  const quiz = await generateQuestions({ topic: 'Linear equations', type: 'Multiple Choice', difficulty: 'Easy', numQuestions: 1, language: 'en' });
  if (!quiz.ok) throw new Error(`quiz: ${quiz.error.code}`);
  if (quiz.data.questions.length !== 1 || quiz.data.questions[0].options?.length !== 4) throw new Error('Invalid quiz contract');
  console.log('Quiz structured-output contract passed.');
  const chat = await aiCoachingChatbotForQuizReview({ userMessage: 'How can I improve?', preferredLanguage: 'en', quizQuestions: [], quizSummary: { totalQuestions: 1, correctAnswers: 1, incorrectAnswers: 0, errorAnalysis: {}, cognitiveMetrics: { conceptMastery: 100, applicationSkill: 100, problemDecomposition: 100, logicalReasoning: 100, errorAwareness: 100, instructionFollowing: 100 } } });
  if (!chat.ok) throw new Error(`chat: ${chat.error.code}`);
  if (!chat.data.aiResponse.trim()) throw new Error('Empty chatbot reply');
  console.log('OpenRouter quiz and chatbot flow smoke tests passed.');
}
main().catch(error => { console.error(error instanceof Error ? error.message : 'Smoke test failed'); process.exitCode = 1; });
