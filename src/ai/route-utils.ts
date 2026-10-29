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

export const BODY_READ_TIMEOUT_MS = 10_000;

export async function boundedJson(request: Request, maximumBytes: number): Promise<unknown> {
  const length = Number(request.headers.get('content-length'));
  if (Number.isFinite(length) && length > maximumBytes) throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
  const reader = request.body?.getReader();
  if (!reader) return JSON.parse('');
  const chunks: Uint8Array[] = [];
  let size = 0;
  let abort = () => {};
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<never>((_, reject) => {
    abort = () => reject(new ApiError('APP-REQUEST-CANCELLED', 408, 'The request was cancelled.'));
    request.signal.addEventListener('abort', abort, { once: true });
    timer = setTimeout(() => reject(new ApiError('APP-BODY-TIMEOUT', 408, 'Request data was not received in time.')), BODY_READ_TIMEOUT_MS);
    if (request.signal.aborted) abort();
  });
  const consume = async () => {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maximumBytes) {
        throw new ApiError('APP-PAYLOAD-TOO-LARGE', 413, 'Request data is too large.');
      }
      chunks.push(value);
    }
  };
  try {
    await Promise.race([consume(), budget]);
  } catch (error) {
    // Cancellation is best-effort: an uncooperative stream must not hold the
    // response after its byte/time budget has already been exceeded.
    void reader.cancel().catch(() => undefined);
    throw error;
  } finally {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abort);
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export function protocolJson(value: AiProtocolResponse) {
  const status = value.state === 'running' ? 202 : value.state === 'failed' ? 422 : value.state === 'cancelled' ? 409 : 200;
  return NextResponse.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
}

export function aiProtocolEnabled() {
  if (process.env.NODE_ENV !== 'production') return process.env.AI_GENERATION_PROTOCOL_ENABLED !== 'false';
  return process.env.AI_GENERATION_PROTOCOL_ENABLED === 'true';
}
