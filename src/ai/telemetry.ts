import 'server-only';
import { createHash } from 'node:crypto';
import type { AiGenerationState,AiOperation } from './protocol';
import type { AiFailureKind } from './openrouter';

export type AiStage = 'create_started' | 'create_succeeded' | 'create_failed' | 'read_failed' | 'cancel_succeeded' | 'cancel_failed'
  | 'claim_started' | 'claim_accepted' | 'claim_observed' | 'claim_failed'
  | 'provider_dispatch' | 'provider_received' | 'provider_failed' | 'parse_started' | 'parse_succeeded'
  | 'provider_body_received' | 'provider_body_failed' | 'envelope_parse_started' | 'envelope_parse_succeeded' | 'envelope_parse_failed' | 'envelope_validation_failed'
  | 'parse_failed' | 'validation_started' | 'validation_succeeded' | 'validation_failed'
  | 'finalize_started' | 'finalize_succeeded' | 'finalize_failed' | 'lease_recovered';

/** Content-free operational event. Never pass inputs, prompts, outputs, tokens, or provider bodies. */
export function recordAiEvent(event: {
  generationId: string;
  operation?: AiOperation;
  state?: AiGenerationState;
  stage?: AiStage;
  durationMs?: number;
  outcome?: string;
  failureKind?: AiFailureKind;
}) {
  const correlationId = createHash('sha256').update(event.generationId).digest('hex').slice(0, 16);
  console.info(JSON.stringify({ event: 'ai_generation', correlationId,
    ...(event.operation ? { operation: event.operation } : {}),
    ...(event.state ? { state: event.state } : {}),
    ...(event.stage ? { stage: event.stage } : {}),
    ...(event.durationMs === undefined ? {} : { durationMs: event.durationMs }),
    ...(event.outcome ? { outcome: event.outcome } : {}),
    ...(event.failureKind ? { failureKind: event.failureKind } : {}),
  }));
}
