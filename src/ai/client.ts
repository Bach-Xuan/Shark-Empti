'use client';
import { initializeFirebase } from '@/firebase';
import { createAppError,failure,success,type AppResult } from '@/lib/app-error';
import type { AiClientState,AiOperation,AiProtocolResponse } from './protocol';

type RunOptions = { signal?: AbortSignal; onState?: (state: AiClientState) => void };
const wait = (milliseconds: number, signal?: AbortSignal) => new Promise<void>((resolve, reject) => {
  const abort = () => { clearTimeout(timer); reject(new DOMException('Aborted', 'AbortError')); };
  const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve(); }, milliseconds);
  signal?.addEventListener('abort', abort, { once: true });
});

async function token(forceRefresh = false) {
  const user = initializeFirebase().auth.currentUser;
  if (!user) throw createAppError('AUTH-REQUIRED', 'Sign in to use AI features.');
  return user.getIdToken(forceRefresh);
}

async function request(path: string, method: string, body: unknown, forceRefresh = false, signal?: AbortSignal): Promise<AiProtocolResponse> {
  const response = await fetch(path, { method, headers: { Authorization: `Bearer ${await token(forceRefresh)}`, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal });
  const payload = await response.json().catch(() => null) as (AiProtocolResponse & { code?: string; error?: string }) | null;
  if (response.status === 401 && payload?.code === 'AUTH-INVALID' && !forceRefresh) return request(path, method, body, true, signal);
  if (!response.ok && !payload?.state) throw createAppError(payload?.code ?? 'APP-REQUEST-FAILED', typeof payload?.error === 'string' ? payload.error : 'Could not complete the AI request.');
  if (!payload) throw createAppError('APP-INVALID-RESPONSE', 'The AI service returned an invalid response.');
  return payload;
}

async function cancel(generationId: string) {
  try { await request(`/api/ai/generations/${generationId}`, 'DELETE', undefined); } catch { /* Best-effort; the ledger remains authoritative. */ }
}

/** Shared client state machine for all seven AI operations. */
export async function runAiOperation<T>(operation: AiOperation, input: unknown, options: RunOptions = {}): Promise<AppResult<T>> {
  const generationId = crypto.randomUUID();
  const state = (value: AiClientState) => options.onState?.(value);
  const abort = () => { state('cancelling'); void cancel(generationId); };
  options.signal?.addEventListener('abort', abort, { once: true });
  try {
    state('creating');
    let current = await request('/api/ai/generations', 'POST', { generationId, operation, input }, false, options.signal);
    while (true) {
      if (options.signal?.aborted) throw createAppError('AI-CANCELLED', 'The AI request was cancelled.');
      if (current.state === 'succeeded') { state('succeeded'); return success(current.data as T); }
      if (current.state === 'failed' || current.state === 'cancelled') { state(current.state); return failure(current.error ?? createAppError('AI-REQUEST-FAILED', 'The AI request could not be completed.')); }
      if (current.state === 'cancel_requested') { state('cancelling'); await wait(500, options.signal); }
      else if (current.state === 'running') { state('recovering'); await wait(current.pollAfterMs ?? 1_000, options.signal); }
      else {
        if (current.retryAfterMs) { state('retry_wait'); await wait(current.retryAfterMs, options.signal); }
        state('attempting');
        try { current = await request(`/api/ai/generations/${generationId}/attempt`, 'POST', undefined, false, options.signal); continue; }
        catch (error) {
          if (options.signal?.aborted) throw error;
          state('recovering');
        }
      }
      current = await request(`/api/ai/generations/${generationId}`, 'GET', undefined, false, options.signal);
    }
  } catch (error) {
    const appError = options.signal?.aborted
      ? createAppError('AI-CANCELLED', 'The AI request was cancelled.')
      : typeof error === 'object' && error && 'code' in error ? error as ReturnType<typeof createAppError> : createAppError('APP-REQUEST-FAILED', 'Could not complete the AI request.');
    state(appError.code === 'AI-CANCELLED' ? 'cancelled' : 'failed');
    return failure(appError);
  } finally { options.signal?.removeEventListener('abort', abort); }
}
