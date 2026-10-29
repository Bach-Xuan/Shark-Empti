'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { readDraft, removeDraft, writeDraft } from '@/lib/draft-storage';
import type { Language } from '@/lib/types';

/** The account provider remounts this owner-scoped hook on UID changes. */
export function useLearningDraft<T>(owner: string | undefined, kind: string, value: T | null, parse: (value: unknown) => T | null, restore: (value: T) => void) {
  const [restored, setRestored] = useState(false);
  const [available, setAvailable] = useState(true);
  const handlers = useRef({ parse, restore, value });
  useEffect(() => { handlers.current = { parse, restore, value }; });
  const loaded = useRef(false), skipWrite = useRef(false);
  useEffect(() => {
    if (!owner || loaded.current) return;
    loaded.current = true;
    const saved = readDraft(owner, kind, handlers.current.parse);
    if (saved) { skipWrite.current = true; handlers.current.restore(saved); setRestored(true); }
  }, [owner, kind]);
  useEffect(() => {
    if (!owner || !loaded.current) return;
    if (skipWrite.current) { skipWrite.current = false; return; }
    if (!value) { removeDraft(owner, kind); return; }
    setAvailable(writeDraft(owner, kind, value));
  }, [owner, kind, value]);
  useEffect(() => {
    if (!owner) return;
    const flush = () => { if (handlers.current.value) writeDraft(owner, kind, handlers.current.value); };
    window.addEventListener('beforeunload', flush);
    document.addEventListener('visibilitychange', flush);
    return () => { window.removeEventListener('beforeunload', flush); document.removeEventListener('visibilitychange', flush); };
  }, [owner, kind]);
  return { restored, available };
}

export const confirmLearningLeave = (active: boolean, lang: Language) => !active || window.confirm(lang === 'vi' ? 'Phiên học chưa hoàn tất. Bạn có muốn rời trang? Bản nháp chỉ có thể khôi phục trong tab này nếu trình duyệt lưu được.' : 'This session is unfinished. Leave this view? A draft can only be recovered in this tab if browser storage is available.');
export function useLearningLeaveGuard(active: boolean, lang: Language) {
  const confirmLeave = useCallback(() => confirmLearningLeave(active, lang), [active, lang]);
  useEffect(() => {
    if (!active) return;
    const unload = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    const click = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
      const url = new URL(link.href, location.href);
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return;
      if (!confirmLeave()) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', click, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', click, true); };
  }, [active, confirmLeave]);
  return confirmLeave;
}
