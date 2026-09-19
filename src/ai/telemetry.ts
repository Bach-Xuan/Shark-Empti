import 'server-only';
import { createHash } from 'node:crypto';
import type { AiGenerationState,AiOperation } from './protocol';

/** Content-free operational event. Never pass inputs, prompts, outputs, tokens, or provider bodies. */
export function recordAiEvent(event: {
  generationId: string;
  operation: AiOperation;
  state: AiGenerationState;
  durationMs?: number;
  outcome?: string;
}) {
  const correlationId = createHash('sha256').update(event.generationId).digest('hex').slice(0, 16);
  console.info(JSON.stringify({ event: 'ai_generation', correlationId, operation: event.operation, state: event.state, ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }), ...(event.outcome ? { outcome: event.outcome } : {}) }));
}
