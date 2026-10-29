'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export type MutationResult = { ok: true } | { ok: false };

/** Render boundaries do not handle requests. Failure reporting belongs here. */
export function useMutation() {
  const lock = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [pending, setPending] = useState(false);
  const run = useCallback(async (
    operation: () => Promise<unknown>,
    onError: (cause: unknown) => void,
  ): Promise<MutationResult> => {
    if (lock.current) return { ok: false };
    lock.current = true;
    setPending(true);
    try {
      await operation();
      return { ok: mounted.current };
    } catch (cause) {
      if (mounted.current) onError(cause);
      return { ok: false };
    } finally {
      lock.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);
  const isPending = useCallback(() => lock.current, []);
  return { run, pending, isPending };
}
