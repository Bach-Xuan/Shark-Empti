import { z } from 'zod';
import { questionContentSchema } from '@/ai/question-schema';
import { cognitiveMetricsSchema, boundedLanguageAnalysisSchema } from './analysis-schema';
import { arenaConfigSchema } from './public-firestore-schema';
import { LEARNING_LIMITS } from './data-limits';

export const learningKinds = ['history', 'flashcards', 'practice'] as const;
export type LearningKind = typeof learningKinds[number];
const text = (max: number) => z.string().min(1).max(max).refine(value => !!value.trim());
const duration = z.number().finite().nonnegative().max(LEARNING_LIMITS.durationSeconds);
const question = questionContentSchema.safeExtend({
  question: text(LEARNING_LIMITS.text), correct: text(LEARNING_LIMITS.answer), explanation: text(LEARNING_LIMITS.text),
  options: z.array(text(LEARNING_LIMITS.answer)).max(4).optional(),
}).strict();
const quizQuestion = question.safeExtend({ difficulty: text(100), section: text(LEARNING_LIMITS.label).optional() }).strict();
const resultFields = { userAnswer: z.string().max(LEARNING_LIMITS.answer), isCorrect: z.boolean(), timeTakenSeconds: duration,
  errorCategory: z.string().max(LEARNING_LIMITS.label).nullable().optional(), aiFeedback: z.string().max(LEARNING_LIMITS.text).nullable().optional() };
export const savedAnalysisSchema = z.object({
  en: boundedLanguageAnalysisSchema, vi: boundedLanguageAnalysisSchema,
  errorCategories: z.record(text(LEARNING_LIMITS.label), z.number().int().min(0).max(LEARNING_LIMITS.items)).refine(value => Object.keys(value).length <= 100),
  cognitiveMetrics: cognitiveMetricsSchema.strict(),
}).strict();
export const historyWriteSchema = z.object({
  schemaVersion: z.literal(2), config: arenaConfigSchema.strict(),
  quizResults: z.array(quizQuestion.safeExtend(resultFields).strict()).min(1).max(LEARNING_LIMITS.items),
  totalTime: duration, date: z.number().int().nonnegative().max(253_402_300_799_999), lang: z.enum(['en', 'vi']),
  analysis: savedAnalysisSchema.optional(),
}).strict().refine(value => value.quizResults.length === Number(value.config.numQuestions), { message: 'Result count must match the configuration.' });
export const historyFeedbackSchema = z.object({ analysis: savedAnalysisSchema, topicEn: text(LEARNING_LIMITS.label), topicVi: text(LEARNING_LIMITS.label) }).strict();
export const flashcardWriteSchema = z.object({
  sourceType: z.enum(['manual', 'weak_point']), sourceValue: text(LEARNING_LIMITS.label),
  cards: z.array(z.object({ front: text(LEARNING_LIMITS.text), back: text(LEARNING_LIMITS.text) }).strict()).min(1).max(LEARNING_LIMITS.items),
}).strict();
const practiceQuestion = question.safeExtend({ type: z.enum(['Multiple Choice', 'Short Answer']) }).strict();
export const practiceWriteSchema = z.object({
  concept: text(LEARNING_LIMITS.label), questions: z.array(practiceQuestion).min(1).max(LEARNING_LIMITS.items),
  userAnswers: z.array(practiceQuestion.safeExtend({ userAnswer: z.string().max(LEARNING_LIMITS.answer), isCorrect: z.boolean() }).strict()).min(1).max(LEARNING_LIMITS.items),
  score: z.number().int().min(0).max(100),
}).strict().superRefine((value, context) => {
  if (value.questions.length !== value.userAnswers.length || value.questions.some((q, index) => {
    const answer = value.userAnswers[index];
    return !answer || (['question', 'correct', 'explanation', 'type'] as const).some(key => q[key] !== answer[key])
      || JSON.stringify(q.options ?? []) !== JSON.stringify(answer.options ?? []);
  })) context.addIssue({ code: 'custom', path: ['userAnswers'], message: 'Answers must correspond to the saved questions.' });
  const score = Math.round(value.userAnswers.filter(answer => answer.isCorrect).length / value.questions.length * 100);
  if (score !== value.score) context.addIssue({ code: 'custom', path: ['score'], message: 'Score must match the saved answers.' });
});
export const learningWriteSchemas = { history: historyWriteSchema, flashcards: flashcardWriteSchema, practice: practiceWriteSchema } as const;
