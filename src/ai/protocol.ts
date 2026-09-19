import type { AppError } from '@/lib/app-error';

export const AI_OPERATIONS = [
  'academic-validation',
  'generate-questions',
  'generate-flashcards',
  'generate-practice',
  'short-answer-analysis',
  'personalized-quiz-feedback',
  'ai-coaching-chatbot',
] as const;

export type AiOperation = typeof AI_OPERATIONS[number];
export type AiGenerationState = 'ready' | 'running' | 'retryable' | 'succeeded' | 'failed' | 'cancel_requested' | 'cancelled';
export type AiClientState = 'idle' | 'creating' | 'attempting' | 'recovering' | 'retry_wait' | 'succeeded' | 'failed' | 'cancelling' | 'cancelled';

export type AiProtocolResponse = {
  generationId: string;
  state: AiGenerationState;
  data?: unknown;
  error?: AppError;
  pollAfterMs?: number;
  retryAfterMs?: number;
};

export const isAiOperation = (value: unknown): value is AiOperation =>
  typeof value === 'string' && (AI_OPERATIONS as readonly string[]).includes(value);
