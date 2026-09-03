'use client';

import { warmOpenRouterModelPriority } from '@/ai/flows/warm-openrouter-models-flow';
import { useEffect } from 'react';

const INITIAL_DELAY_MS = 1_000;
const MAX_RETRY_DELAY_MS = 5 * 60_000;

/**
 * Keeps model probing off the critical rendering path. A failed complete pass
 * is retried with a bounded backoff; interactive flows never wait for it and
 * have their own fallback path in the server adapter.
 */
export function AiModelWarmup() {
  useEffect(() => {
    let stopped = false;
    let retryDelay = 15_000;
    let timer: number | undefined;

    const schedule = (delay: number) => {
      timer = window.setTimeout(() => void run(), delay);
    };
    const run = async () => {
      try {
        const result = await warmOpenRouterModelPriority();
        if (stopped || result.available || !result.retryable) return;
      } catch {
        // The foreground flow shows a safe error if the service remains down.
      }
      if (!stopped) {
        schedule(retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_DELAY_MS);
      }
    };

    schedule(INITIAL_DELAY_MS);
    return () => {
      stopped = true;
      if (timer) window.clearTimeout(timer);
    };
  }, []);

  return null;
}
