import { z } from 'zod';
import { LEARNING_LIMITS } from '@/lib/data-limits';

export const generationCount = z.number().int().min(1).max(50);
const nonempty = z.string().trim().min(1);

/** Cross-field constraints are checked locally even if the provider accepts the JSON Schema. */
export const questionContentSchema = z.object({
  question: nonempty.max(LEARNING_LIMITS.text),
  type: z.enum(['Multiple Choice', 'True/False', 'Short Answer']),
  options: z.array(nonempty.max(LEARNING_LIMITS.answer)).max(4).optional(),
  correct: nonempty.max(LEARNING_LIMITS.answer),
  explanation: nonempty.max(LEARNING_LIMITS.text),
}).superRefine((question, context) => {
  const expected = question.type === 'Multiple Choice' ? 4 : question.type === 'True/False' ? 2 : 0;
  const options = question.options?.map(option => option.trim().toLowerCase()) ?? [];
  if (options.length !== expected || new Set(options).size !== options.length) {
    context.addIssue({ code: 'custom', path: ['options'], message: 'Invalid option count or duplicate options.' });
  }
  if (expected && !options.includes(question.correct.trim().toLowerCase())) {
    context.addIssue({ code: 'custom', path: ['correct'], message: 'Answer must match an option.' });
  }
});
