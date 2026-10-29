import 'server-only';
import { z } from 'zod';
import { arenaQuestionSchema } from './public-firestore-schema';
import { ApiError } from './server-api';
import { isTrustedArenaExam } from './arena-scoring';

const keySchema = z.object({ schemaVersion: z.literal(2), authorId: z.string(), questions: z.array(arenaQuestionSchema).min(1).max(50) });
export function readArenaKey(value: unknown, authorId: string, count: number) {
  const parsed = keySchema.safeParse(value);
  if (!parsed.success || parsed.data.authorId !== authorId || parsed.data.questions.length !== count || !isTrustedArenaExam(parsed.data.questions)) throw new ApiError('ARENA-LEGACY-EXAM', 409, 'This exam needs a secure migration before it can be attempted.');
  return parsed.data.questions;
}
export const publicPrompts = (questions: ReturnType<typeof readArenaKey>) => questions.map(({ correct: _correct, explanation: _explanation, ...prompt }) => prompt);
