import { z } from 'zod';
import type { QuizHistoryItem } from './types';

const text = z.union([z.string(), z.number()]).transform(String);
const labels = z.object({ strengths: z.array(z.string()), weaknesses: z.array(z.string()), recommendations: z.array(z.string()) });
const analysis = z.object({
  en: labels, vi: labels, errorCategories: z.record(z.string(), z.number()),
  cognitiveMetrics: z.object({ conceptMastery: z.number(), applicationSkill: z.number(), problemDecomposition: z.number(), logicalReasoning: z.number(), errorAwareness: z.number(), instructionFollowing: z.number() }),
});
const historySchema = z.object({
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
