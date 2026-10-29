import { z } from 'zod';
import { questionContentSchema } from '@/ai/question-schema';
import { arenaConfigSchema } from './public-firestore-schema';
import type { QuizResultItem } from './types';

export { DRAFT_TTL_MS, readDraft, writeDraft, removeDraft, pruneDraftsForOwner } from './draft-storage';
export const parseWith = <T>(schema: z.ZodType<T>) => (value: unknown): T | null => { const result = schema.safeParse(value); return result.success ? result.data : null; };
export const arenaSessionDraftSchema = z.object({ examId: z.string().min(1).max(1500), requestId: z.string().uuid() });
const fullQuestion = questionContentSchema.safeExtend({ difficulty: z.string().max(100).default('Mixed'), section: z.string().max(200).optional() });
export const sessionDraftSchema = z.object({ id: z.string().uuid(), config: arenaConfigSchema, questions: z.array(fullQuestion).min(1).max(50) }).refine(value => value.questions.length === Number(value.config.numQuestions));
const result = z.object({ question: z.string().max(20000), correct: z.string().max(2000), explanation: z.string().max(20000), type: z.string(), difficulty: z.string(), options: z.array(z.string().max(2000)).max(4).optional(), section: z.string().optional(), userAnswer: z.string().max(2000), isCorrect: z.boolean(), timeTakenSeconds: z.number().finite().nonnegative(), errorCategory: z.string().nullable().optional(), aiFeedback: z.string().nullable().optional() });
export const quizDraftSchema = z.object({ id: z.string().uuid(), index: z.number().int().min(0).max(49), answers: z.array(result).max(50), feedback: result.nullable(), input: z.string().max(2000), startedAtMs: z.number().int().positive(), questionStartedAtMs: z.number().int().positive(), completion: z.unknown().optional() });
export type QuizDraft = Omit<z.infer<typeof quizDraftSchema>, 'answers' | 'feedback'> & { answers: QuizResultItem[]; feedback: QuizResultItem | null };
const practiceQuestion = z.object({ question: z.string().max(20000), correct: z.string().max(2000), explanation: z.string().max(20000), type: z.enum(['Multiple Choice', 'Short Answer']), options: z.array(z.string().max(2000)).max(4).optional() });
const practiceFeedback = practiceQuestion.extend({ userAnswer: z.string().max(2000), isCorrect: z.boolean() });
export const practiceDraftSchema = z.object({ id: z.string().uuid(), concept: z.string().max(200), questions: z.array(practiceQuestion).min(1).max(50), index: z.number().int().min(0).max(49), answers: z.array(practiceFeedback).max(50), feedback: practiceFeedback.nullable(), input: z.string().max(2000) }).refine(value => value.index < value.questions.length && value.answers.length === value.index);
export const flashcardDraftSchema = z.object({ topic: z.string().max(200), cards: z.array(z.object({ front: z.string().max(20000), back: z.string().max(20000) })).min(1).max(50), index: z.number().int().min(0).max(49), flipped: z.boolean() }).refine(value => value.index < value.cards.length);
