'use client';
import { useCallback, useEffect, useMemo, useRef } from 'react';

/** One component-owned request at a time; remount/account changes revoke work. */
export function useRequestScope() {
  const active = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const cancel = useCallback(() => { active.current?.abort(); active.current = null; }, []);
  const start = useCallback(() => {
    cancel();
    const controller = new AbortController();
    if (!mounted.current) controller.abort();
    active.current = controller;
    return controller.signal;
  }, [cancel]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; cancel(); };
  }, [cancel]);
  return useMemo(() => ({ start, cancel }), [start, cancel]);
}
