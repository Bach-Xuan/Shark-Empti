import { z } from 'zod';
import type { QuizConfig } from './types';
export type QuizConfigDraft = QuizConfig;
const positiveInteger = z.union([z.string().regex(/^\d+$/).transform(Number), z.number()]).pipe(z.number().int().positive());
export const numericQuizConfigSchema = z.object({ numQuestions: positiveInteger.pipe(z.number().max(50)), timeLimit: z.preprocess(value => value === '' || value == null ? undefined : value, positiveInteger.pipe(z.number().max(180)).optional()) });
export type ValidatedQuizConfig = Omit<QuizConfig, 'numQuestions' | 'timeLimit'> & z.infer<typeof numericQuizConfigSchema>;
export function validateQuizConfig(config: QuizConfig): ValidatedQuizConfig { const numeric = numericQuizConfigSchema.parse(config); return { ...config, ...numeric, timeLimit: numeric.timeLimit }; }
