'use client';
import { initializeFirebase } from '@/firebase';
import { createAppError, failure, success, type AppError, type AppResult } from '@/lib/app-error';
import type { AiClientState, AiOperation, AiProtocolResponse } from './protocol';

export type RunOptions = { signal?: AbortSignal; onState?: (state: AiClientState) => void };
const OPERATION_TIMEOUT_MS = 120_000;
const REQUEST_TIMEOUT_MS = 30_000;
const STATES = new Set(['ready', 'running', 'retryable', 'succeeded', 'failed', 'cancel_requested', 'cancelled']);

class RequestFailure extends Error {
  constructor(readonly status: number, readonly appError: AppError) { super(appError.message); }
}

function abortError() { return new DOMException('Aborted', 'AbortError'); }

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(abortError()); return; }
    const abort = () => { clearTimeout(timer); reject(abortError()); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, Math.min(milliseconds, OPERATION_TIMEOUT_MS));
    signal.addEventListener('abort', abort, { once: true });
  });
}

/** Firebase token refresh is not cancellable; stop waiting and ignore its late result. */
function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener('abort', abort); reject(abortError()); };
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
    promise.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
}

async function request(generationId: string, path: string, method: string, body: unknown, signal: AbortSignal, refreshed = false): Promise<AiProtocolResponse> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  signal.addEventListener('abort', abort, { once: true });
  if (signal.aborted) abort();
  const timeout = setTimeout(abort, REQUEST_TIMEOUT_MS);
  try {
    if (controller.signal.aborted) throw abortError();
    const user = initializeFirebase().auth.currentUser;
    if (!user) throw createAppError('AUTH-REQUIRED', 'Sign in to use AI features.');
    const token = await abortable(user.getIdToken(refreshed), controller.signal);
    const response = await fetch(path, {
      method, signal: controller.signal,
      headers: { Authorization: `Bearer ${token}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    const payload = await response.json().catch(() => null);
    if (response.status === 401 && payload?.code === 'AUTH-INVALID' && !refreshed) {
      return request(generationId, path, method, body, signal, true);
    }
    const terminalResponse = (response.status === 422 && payload?.state === 'failed') || (response.status === 409 && payload?.state === 'cancelled');
    if (!response.ok && !terminalResponse) {
      throw new RequestFailure(response.status, createAppError(
        typeof payload?.code === 'string' ? payload.code : 'APP-REQUEST-FAILED',
        typeof payload?.error === 'string' ? payload.error : 'Could not complete the AI request.',
      ));
    }
    if (!payload || payload.generationId !== generationId || !STATES.has(payload.state)
      || ['pollAfterMs', 'retryAfterMs'].some(key => payload[key] !== undefined && (!Number.isFinite(payload[key]) || payload[key] < 0))) {
      throw new RequestFailure(502, createAppError('APP-INVALID-RESPONSE', 'The AI service returned an invalid response.'));
    }
    return payload;
  } catch (error) {
    if (controller.signal.aborted && !signal.aborted) throw new RequestFailure(504, createAppError('AI-TIMEOUT', 'The AI request timed out.'));
    throw error;
  } finally {
    clearTimeout(timeout);
    signal.removeEventListener('abort', abort);
  }
}

const recoverable = (error: unknown) => error instanceof RequestFailure
  ? error.status >= 500 || error.appError.code === 'AI-LEASE-CONFLICT'
  : error instanceof TypeError || (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name));

async function cancel(generationId: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3_000);
  try { await request(generationId, `/api/ai/generations/${generationId}`, 'DELETE', undefined, controller.signal); }
  catch { /* Best effort; an expired lease is settled by the ledger. */ }
  finally { clearTimeout(timeout); }
}

/** Bounded owner-scoped recovery. Rejections are not mistaken for response loss. */
export async function runAiOperation<T>(operation: AiOperation, input: unknown, options: RunOptions = {}): Promise<AppResult<T>> {
  const generationId = crypto.randomUUID();
  const controller = new AbortController();
  const signal = controller.signal;
  const state = (value: AiClientState) => options.onState?.(value);
  let dispatched = false;
  let timedOut = false;
  const abort = () => controller.abort();
  const onAbort = () => { if (dispatched) { state('cancelling'); void cancel(generationId); } };
  options.signal?.addEventListener('abort', abort, { once: true });
  signal.addEventListener('abort', onAbort, { once: true });
  if (options.signal?.aborted) abort();
  const deadline = setTimeout(() => { timedOut = true; abort(); }, OPERATION_TIMEOUT_MS);

  const retryTransport = async (action: () => Promise<AiProtocolResponse>) => {
    for (let attempt = 0; ; attempt++) {
      try { return await action(); }
      catch (error) {
        if (signal.aborted || !recoverable(error) || attempt >= 1) throw error;
        await wait(250, signal);
      }
    }
  };
  const status = () => retryTransport(() => request(generationId, `/api/ai/generations/${generationId}`, 'GET', undefined, signal));

  try {
    if (signal.aborted) throw abortError();
    state('creating');
    dispatched = true;
    // A lost creation response reuses the same UUID and validated input.
    let current = await retryTransport(() => request(generationId, '/api/ai/generations', 'POST', { generationId, operation, input }, signal));
    let lostAttempts = 0;
    while (true) {
      if (signal.aborted) throw abortError();
      if (current.state === 'succeeded') { state('succeeded'); return success(current.data as T); }
      if (current.state === 'failed' || current.state === 'cancelled') {
        state(current.state);
        return failure(current.error ?? createAppError('AI-REQUEST-FAILED', 'The AI request could not be completed.'));
      }
      if (current.state === 'cancel_requested' || current.state === 'running') {
        state(current.state === 'running' ? 'recovering' : 'cancelling');
        await wait(Math.max(250, Math.min(5_000, current.pollAfterMs ?? 1_000)), signal);
        current = await status();
        continue;
      }
      if (current.retryAfterMs) { state('retry_wait'); await wait(current.retryAfterMs, signal); }
      state('attempting');
      try { current = await request(generationId, `/api/ai/generations/${generationId}/attempt`, 'POST', undefined, signal); }
      catch (error) {
        if (signal.aborted || !recoverable(error)) throw error;
        state('recovering');
        current = await status();
        // A rejected claim must not become an automatic retry storm.
        if (['ready', 'retryable'].includes(current.state)
          && ((error instanceof RequestFailure && error.appError.code !== 'AI-LEASE-CONFLICT') || ++lostAttempts > 2)) throw error;
      }
    }
  } catch (error) {
    const appError = timedOut ? createAppError('AI-RECOVERY-TIMEOUT', 'The AI request could not recover in time.')
      : options.signal?.aborted ? createAppError('AI-CANCELLED', 'The AI request was cancelled.')
      : error instanceof RequestFailure ? error.appError
      : typeof error === 'object' && error && 'code' in error && typeof error.code === 'string' ? error as AppError
      : createAppError('APP-REQUEST-FAILED', 'Could not complete the AI request.');
    state(appError.code === 'AI-CANCELLED' ? 'cancelled' : 'failed');
    return failure(appError);
  } finally {
    clearTimeout(deadline);
    options.signal?.removeEventListener('abort', abort);
    signal.removeEventListener('abort', onAbort);
  }
}
