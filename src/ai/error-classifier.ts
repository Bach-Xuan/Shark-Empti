import type { NormalizedAiFailure } from './openrouter';

export type RetryDecision = 'terminal' | 'retry_next_model' | 'retry_after' | 'cancelled';
export function classifyAiFailure(failure: NormalizedAiFailure): { decision: RetryDecision; retryAfterMs?: number } {
  if (failure.kind === 'cancelled') return { decision: 'cancelled' };
  if (failure.kind === 'provider') {
    if (failure.httpStatus === 429) return { decision: 'retry_after', retryAfterMs: Math.max(1_000, failure.retryAfterMs ?? 5_000) };
    if (failure.httpStatus === 408 || failure.httpStatus === 529 || (failure.httpStatus !== undefined && failure.httpStatus >= 500)) return { decision: 'retry_next_model' };
    return { decision: 'terminal' };
  }
  if (['timeout', 'dns', 'tls', 'reset', 'transport', 'empty', 'invalid_json', 'invalid_schema'].includes(failure.kind)) return { decision: 'retry_next_model' };
  return { decision: 'terminal' };
}
