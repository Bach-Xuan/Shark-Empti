import type { NormalizedAiFailure } from './openrouter';
import { AI_IO_LIMITS } from './config/limits';

export type RetryDecision = 'terminal' | 'retry_next_model' | 'retry_after' | 'cancelled';
export function classifyAiFailure(failure: NormalizedAiFailure): { decision: RetryDecision; retryAfterMs?: number } {
  if (failure.kind === 'cancelled') return { decision: 'cancelled' };
  if (failure.kind === 'provider') {
    if (failure.httpStatus === 429) {
      const delay = failure.retryAfterMs ?? 5_000;
      // Do not retry earlier than a long provider hint or create an invalid
      // Firestore timestamp. A later user action can start a fresh operation.
      if (!Number.isFinite(delay) || delay > AI_IO_LIMITS.inlineRetryWaitMs) return { decision: 'terminal' };
      return { decision: 'retry_after', retryAfterMs: Math.max(1_000, delay) };
    }
    if (failure.httpStatus === 408 || failure.httpStatus === 529 || (failure.httpStatus !== undefined && failure.httpStatus >= 500)) return { decision: 'retry_next_model' };
    return { decision: 'terminal' };
  }
  if (['timeout', 'dns', 'tls', 'reset', 'transport', 'empty', 'invalid_json', 'invalid_schema', 'response_too_large'].includes(failure.kind)) return { decision: 'retry_next_model' };
  return { decision: 'terminal' };
}
