import type { QuizAnalysis,QuizHistoryItem } from '@/lib/types';
export const question = { question: '2+2?', section: 'Addition', correct: '4', options: ['4', '3', '2', '1'], explanation: 'Addition', type: 'Multiple Choice', difficulty: 'Recognition' };
export const analysis: QuizAnalysis = {
  en: { strengths: ['Addition'], weaknesses: [], recommendations: ['Practice'] },
  vi: { strengths: ['Phép cộng'], weaknesses: [], recommendations: ['Luyện tập'] },
  errorCategories: {},
  cognitiveMetrics: { conceptMastery: 100, applicationSkill: 100, problemDecomposition: 100, logicalReasoning: 100, errorAwareness: 100, instructionFollowing: 100 },
};
export const history: QuizHistoryItem = {
  date: '2026-09-03', lang: 'en', totalTime: 1, analysis,
  config: { topic: 'Addition', subject: 'math', grade: 'none', numQuestions: '1', type: 'Multiple Choice', difficulty: 'Recognition' },
  quizResults: [{ ...question, isCorrect: true, userAnswer: '4', timeTakenSeconds: 1 }],
};
