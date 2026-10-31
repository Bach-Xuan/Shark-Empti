import 'server-only';
import { NextResponse } from 'next/server';
import { ApiError, apiFailure } from '@/lib/server-api';
import type { AiProtocolResponse } from './protocol';
import { recordAiEvent, type AiStage } from './telemetry';

/** Classify storage failures without serializing gRPC messages or payloads. */
export function aiApiFailure(error: unknown, context: { generationId?: string; stage: AiStage; persistence?: boolean }) {
  const code = typeof error === 'object' && error && 'code' in error ? error.code : undefined;
  const storage = context.persistence && !(error instanceof ApiError)
    && [3, 4, 6, 7, 8, 9, 10, 13, 14, 16, 'invalid-argument', 'deadline-exceeded', 'already-exists', 'permission-denied', 'resource-exhausted', 'failed-precondition', 'aborted', 'internal', 'unavailable', 'unauthenticated'].includes(code as string | number);
  const failure = storage ? new ApiError('AI-PERSISTENCE-UNAVAILABLE', 503, 'AI state could not be saved. Recover its status before retrying.') : error;
  if (context.generationId) recordAiEvent({ generationId: context.generationId, stage: context.stage, outcome: failure instanceof ApiError ? failure.code : 'APP-REQUEST-FAILED' });
  return apiFailure(failure);
}

export { readLimitedJson as boundedJson, BODY_READ_TIMEOUT_MS } from '@/lib/server-json';

export function protocolJson(value: AiProtocolResponse) {
  const status = value.state === 'running' ? 202 : value.state === 'failed' ? 422 : value.state === 'cancelled' ? 409 : 200;
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function aiProtocolEnabled() {
  if (process.env.NODE_ENV !== 'production') return process.env.AI_GENERATION_PROTOCOL_ENABLED !== 'false';
  return process.env.AI_GENERATION_PROTOCOL_ENABLED === 'true';
}
