import { z } from 'zod';
import { cognitiveMetricsSchema,languageAnalysisSchema as labels } from './analysis-schema';
import type { QuizHistoryItem } from './types';

const text = z.union([z.string(), z.number()]).transform(String);
const analysis = z.object({
  en: labels, vi: labels, errorCategories: z.record(z.string(), z.number()),
  cognitiveMetrics: cognitiveMetricsSchema,
});
const historySchema = z.object({
  schemaVersion: z.union([z.literal(1), z.literal(2)]).default(1),
  quizResults: z.array(z.object({
    question: z.string(), correct: text, userAnswer: text.default(''), isCorrect: z.boolean(),
    explanation: z.string().default(''), type: z.string().default('Multiple Choice'), difficulty: z.string().default('Mixed'),
    timeTakenSeconds: z.number().finite().nonnegative().default(0), options: z.array(z.string()).optional(), section: z.string().optional(),
    errorCategory: z.string().nullable().optional(), aiFeedback: z.string().nullable().optional(),
  })),
  config: z.object({
    topic: z.string(), subject: z.string().default('none'), grade: z.string().default('none'), type: z.string().default('Mixed'),
    difficulty: z.string().default('Mixed'), numQuestions: text.default(''), timeLimit: text.optional(), excludeNotes: z.string().optional(),
    topicEn: z.string().optional(), topicVi: z.string().optional(),
  }),
  totalTime: z.number().finite().nonnegative().default(0), date: z.string(), lang: z.enum(['vi', 'en']).default('en'),
  analysis: analysis.optional().catch(undefined),
});

/** Read legacy omissions without mutating stored content; reject corrupt core records. */
export function readHistoryItem(id: string, data: unknown): QuizHistoryItem | null {
  const result = historySchema.safeParse(data);
  return result.success ? { ...result.data, id } : null;
}
