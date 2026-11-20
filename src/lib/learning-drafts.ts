import { LEARNING_LIMITS } from '@/lib/data-limits';
import { z } from 'zod';
import { questionContentSchema } from '@/ai/question-schema';
import { arenaConfigSchema } from './public-firestore-schema';
import { historyWriteSchema } from './learning-records';
import type { QuizResultItem } from './types';

export { DRAFT_TTL_MS, readDraft, writeDraft, removeDraft, pruneDraftsForOwner } from './draft-storage';
export const parseWith = <T>(schema: z.ZodType<T>) => (value: unknown): T | null => { const result = schema.safeParse(value); return result.success ? result.data : null; };
export const arenaSessionDraftSchema = z.object({
  examId: z.string().min(1).max(1500),
  requestId: z.string().uuid(),
  submission: z.object({
    answers: z.array(z.string().max(LEARNING_LIMITS.answer)).min(1).max(LEARNING_LIMITS.items),
    date: z.number().int().positive(),
    lang: z.enum(['en', 'vi']),
  }).optional(),
});
export type ArenaSessionDraft = z.infer<typeof arenaSessionDraftSchema>;
const fullQuestion = questionContentSchema.safeExtend({ difficulty: z.string().max(100).default('Mixed'), section: z.string().max(200).optional() });
const activeSessionDraft = z.object({ id: z.string().uuid(), config: arenaConfigSchema, questions: z.array(fullQuestion).min(1).max(50) }).refine(value => value.questions.length === Number(value.config.numQuestions));
// Older generators could return feedback too long to archive. Keep the learner's
// answers and retry identity when recovering a local draft with such feedback.
const draftFeedback = z.string().transform(value => value.length > LEARNING_LIMITS.text ? null : value).nullable().optional();
const draftHistory = z.looseObject({
  quizResults: z.array(z.looseObject({ aiFeedback: draftFeedback })).max(LEARNING_LIMITS.items),
});
// Store a finished payload once, rather than duplicating its potentially large questions.
const pendingSessionDraft = z.object({ id: z.string().uuid(), completion: draftHistory.pipe(historyWriteSchema) }).transform(({ id, completion }) => ({
  id, completion, config: completion.config, questions: completion.quizResults,
}));
export const sessionDraftSchema = z.union([pendingSessionDraft, activeSessionDraft]);
const result = z.object({
  question: z.string().max(LEARNING_LIMITS.text), correct: z.string().max(LEARNING_LIMITS.answer),
  explanation: z.string().max(LEARNING_LIMITS.text), type: z.string(), difficulty: z.string(),
  options: z.array(z.string().max(LEARNING_LIMITS.answer)).max(4).optional(), section: z.string().optional(),
  userAnswer: z.string().max(LEARNING_LIMITS.answer), isCorrect: z.boolean(), timeTakenSeconds: z.number().finite().nonnegative(),
  errorCategory: z.string().nullable().optional(), aiFeedback: draftFeedback,
});
export const quizDraftSchema = z.object({
  id: z.string().uuid(), index: z.number().int().min(0).max(LEARNING_LIMITS.items - 1),
  answers: z.array(result).max(LEARNING_LIMITS.items), feedback: result.nullable(), input: z.string().max(LEARNING_LIMITS.answer),
  startedAtMs: z.number().int().positive(), questionStartedAtMs: z.number().int().positive(),
  completion: z.object({ results: draftHistory, analysis: z.unknown().optional() }).optional().catch(undefined),
});
export type QuizDraft = Omit<z.infer<typeof quizDraftSchema>, 'answers' | 'feedback' | 'completion'> & {
  answers: QuizResultItem[]; feedback: QuizResultItem | null; completion?: unknown;
};
const practiceQuestion = z.object({ question: z.string().max(20000), correct: z.string().max(LEARNING_LIMITS.answer), explanation: z.string().max(20000), type: z.enum(['Multiple Choice', 'Short Answer']), options: z.array(z.string().max(LEARNING_LIMITS.answer)).max(4).optional() });
const practiceFeedback = practiceQuestion.extend({ userAnswer: z.string().max(LEARNING_LIMITS.answer), isCorrect: z.boolean() });
export const practiceDraftSchema = z.object({ id: z.string().uuid(), concept: z.string().max(200), questions: z.array(practiceQuestion).min(1).max(50), index: z.number().int().min(0).max(49), answers: z.array(practiceFeedback).max(50), feedback: practiceFeedback.nullable(), input: z.string().max(LEARNING_LIMITS.answer) }).refine(value => value.index < value.questions.length && value.answers.length === value.index);
export const flashcardDraftSchema = z.object({ topic: z.string().max(200), cards: z.array(z.object({ front: z.string().max(20000), back: z.string().max(20000) })).min(1).max(50), index: z.number().int().min(0).max(49), flipped: z.boolean() }).refine(value => value.index < value.cards.length);
