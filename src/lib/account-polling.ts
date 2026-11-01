import type { JobStatus } from './jobs/types';

export const ACCOUNT_POLLING = {
  activeMs: 12_000, quotaMs: 15 * 60_000, deadlineMs: 30_000, receiptDeadlineMs: 15_000,
  wakeMinMs: 5_000, retryMs: [5_000, 15_000, 30_000, 60_000],
} as const;

export function nextAccountPollDelay(jobs: ReadonlyArray<{ status: JobStatus }>): number | null {
  if (jobs.some(job => job.status === 'queued' || job.status === 'running')) return ACCOUNT_POLLING.activeMs;
  return jobs.some(job => job.status === 'waiting_quota') ? ACCOUNT_POLLING.quotaMs : null;
}

export function isTransientStatusError(error: unknown) {
  if (error instanceof TypeError) return true;
  if (!error || typeof error !== 'object') return false;
  if ('status' in error && typeof error.status === 'number') return error.status === 408 || error.status === 429 || error.status >= 500;
  if ('code' in error && ['APP-UNAVAILABLE', 'APP-REQUEST-FAILED', 'APP-RATE-LIMITED', 'APP-MAINTENANCE',
    'auth/network-request-failed', 'auth/timeout', 'auth/too-many-requests'].includes(String(error.code))) return true;
  return 'name' in error && ['AbortError', 'TimeoutError'].includes(String(error.name));
}

/** Serial, read-only status polling. Four retries per recovery cycle; explicit
 * refresh/online/visible focus can resume it. Each request owns its deadline. */
export function startAccountPolling<T>(options: {
  read: (signal: AbortSignal) => Promise<T>;
  onValue: (value: T) => void;
  onError: (error: unknown, willRetry: boolean) => void;
  nextDelay: (value: T) => number | null;
  deadlineMs?: number;
}) {
  let disposed = false, inFlight = false, canWake = true, exhausted = false, failures = 0;
  let lastStarted: number | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let current: AbortController | null = null;
  const hidden = () => document.visibilityState === 'hidden';
  const schedule = (delay: number) => {
    clearTimeout(timer);
    if (!disposed && !hidden()) timer = setTimeout(() => { void refresh(); }, delay);
  };
  const refresh = async () => {
    if (disposed || inFlight || !canWake || hidden()) return;
    inFlight = true; lastStarted = Date.now();
    const controller = new AbortController(); current = controller;
    let abort!: () => void;
    const aborted = new Promise<never>((_, reject) => {
      abort = () => reject({ code: 'APP-UNAVAILABLE' });
      controller.signal.addEventListener('abort', abort, { once: true });
    });
    const deadline = setTimeout(() => controller.abort(), options.deadlineMs ?? ACCOUNT_POLLING.deadlineMs);
    try {
      const value = await Promise.race([options.read(controller.signal), aborted]);
      if (disposed || controller.signal.aborted) return;
      const delay = options.nextDelay(value);
      failures = 0; exhausted = false; canWake = delay !== null;
      options.onValue(value);
      if (delay !== null) schedule(delay);
    } catch (error) {
      if (disposed) return;
      const transient = isTransientStatusError(error);
      const delay = transient ? ACCOUNT_POLLING.retryMs[failures++] : undefined;
      exhausted = delay === undefined;
      canWake = transient;
      options.onError(error, delay !== undefined);
      if (delay !== undefined) schedule(delay);
    } finally {
      clearTimeout(deadline);
      controller.signal.removeEventListener('abort', abort);
      if (current === controller) current = null;
      inFlight = false;
    }
  };
  const wake = () => {
    if (disposed || hidden() || inFlight || !canWake) return;
    if (exhausted) { failures = 0; exhausted = false; }
    schedule(lastStarted === null ? 0 : Math.max(0, ACCOUNT_POLLING.wakeMinMs - (Date.now() - lastStarted)));
  };
  const visibility = () => { if (hidden()) clearTimeout(timer); else wake(); };
  window.addEventListener('online', wake);
  window.addEventListener('focus', wake);
  document.addEventListener('visibilitychange', visibility);
  void refresh();
  return () => {
    disposed = true; clearTimeout(timer); current?.abort();
    window.removeEventListener('online', wake);
    window.removeEventListener('focus', wake);
    document.removeEventListener('visibilitychange', visibility);
  };
}
