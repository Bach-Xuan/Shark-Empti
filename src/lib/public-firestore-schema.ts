import { z } from 'zod';
import { questionContentSchema } from '@/ai/question-schema';
import { parseNumericAnswer } from './arena-scoring';
import type { StoredDate } from './date-format';
import type { ArenaAttempt, ArenaExam, ForumComment, ForumPost } from './types';

const text = (max: number) => z.string().trim().min(1).max(max);
const count = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);
const identity = text(128);
const photo = z.string().max(2048).refine(value => value === '' || /^https?:\/\//i.test(value));
// Dates are presentation metadata: a corrupt or pending legacy timestamp is unknown.
const storedDate = z.unknown().transform((value): StoredDate => {
  try {
    const date = value instanceof Date ? value : typeof value === 'string' || typeof value === 'number'
      ? new Date(value) : value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function'
        ? value.toDate() : null;
    return date instanceof Date && Number.isFinite(date.getTime()) ? date : null;
  } catch { return null; }
}).default(null);
const author = {
  authorId: identity,
  authorName: text(200).default('Learner'),
  authorPhoto: photo.default(''),
  createdAt: storedDate,
};
const likes = {
  likesCount: count.default(0),
  likedBy: z.array(identity).refine(values => new Set(values).size === values.length).default([]),
};
export const forumPostSchema = z.object({
  ...author, ...likes, title: text(200), content: text(20000), subject: text(100),
  commentsCount: count.default(0), updatedAt: storedDate.optional(),
}).refine(value => value.likesCount === value.likedBy.length);
export const forumCommentSchema = z.object({
  ...author, ...likes, content: text(2000), updatedAt: storedDate.optional(),
}).refine(value => value.likesCount === value.likedBy.length);

const numericText = (max: number) => z.union([z.string().regex(/^\d+$/), z.number().int()])
  .transform(String).refine(value => Number(value) >= 1 && Number(value) <= max);
export const arenaConfigSchema = z.object({
  subject: text(100), grade: text(100), topic: text(200),
  type: z.enum(['Multiple Choice', 'True/False', 'Short Answer', 'Mixed']),
  difficulty: text(100), numQuestions: numericText(50),
  timeLimit: z.preprocess(value => value === '' || value == null ? undefined : value, numericText(999).optional()),
  topicEn: z.string().max(200).optional(), topicVi: z.string().max(200).optional(),
  excludeNotes: z.string().max(20000).optional(),
});
export const arenaQuestionSchema = questionContentSchema.safeExtend({
  question: text(20000), correct: text(2000), explanation: text(20000),
  options: z.array(text(2000)).max(4).optional(),
  difficulty: text(100).default('Mixed'), section: text(200).optional(),
}).refine(question => question.type !== 'Short Answer' || parseNumericAnswer(question.correct) !== null,
  { message: 'Arena numeric answers must use the supported scalar format.' });
export const arenaExamSchema = z.object({
  ...author, title: text(200), config: arenaConfigSchema,
  questions: z.array(arenaQuestionSchema).min(1).max(50), totalAttempts: count.default(0),
}).refine(exam => Number(exam.config.numQuestions) === exam.questions.length,
  { message: 'Question count does not match the configuration.' });
export const arenaAttemptSchema = z.object({
  examId: identity, userId: identity, userName: text(200).default('Learner'),
  userPhoto: photo.default(''), score: z.number().finite().min(0).max(100),
  duration: z.number().finite().nonnegative(), createdAt: storedDate,
});

// Unknown keys are stripped; caller-supplied snapshot IDs always win over stored IDs.
export function readForumPost(id: string, data: unknown): ForumPost | null {
  const result = forumPostSchema.safeParse(data);
  return result.success ? { ...result.data, id } : null;
}
export function readForumComment(id: string, data: unknown): ForumComment | null {
  const result = forumCommentSchema.safeParse(data);
  return result.success ? { ...result.data, id } : null;
}
export function readArenaExam(id: string, data: unknown): ArenaExam | null {
  const result = arenaExamSchema.safeParse(data);
  return result.success ? { ...result.data, id } : null;
}
export function readArenaAttempt(id: string, data: unknown): ArenaAttempt | null {
  const result = arenaAttemptSchema.safeParse(data);
  return result.success ? { ...result.data, id } : null;
}
