'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

/** Scroll restoration and layout shifts are not a request to hide navigation. */
export function useScrollNavigation(destination: string) {
  const navigationRef = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(true);
  const reveal = useCallback(() => setVisible(true), []);
  useEffect(() => {
    let previous = window.scrollY, userScrolling = false;
    setVisible(true);
    const intent = () => { userScrolling = true; };
    const keyboard = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) intent();
    };
    const scroll = () => {
      const current = window.scrollY;
      if (!userScrolling || current < 20 || navigationRef.current?.contains(document.activeElement)) setVisible(true);
      else if (current > previous && current > 120) setVisible(false);
      else if (current < previous) setVisible(true);
      previous = current;
    };
    window.addEventListener('wheel', intent, { passive: true });
    window.addEventListener('touchmove', intent, { passive: true });
    window.addEventListener('keydown', keyboard);
    window.addEventListener('scroll', scroll, { passive: true });
    return () => {
      window.removeEventListener('wheel', intent); window.removeEventListener('touchmove', intent);
      window.removeEventListener('keydown', keyboard); window.removeEventListener('scroll', scroll);
    };
  }, [destination]);
  return { visible, navigationRef, reveal };
}
