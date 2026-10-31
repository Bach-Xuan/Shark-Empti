import type { Page } from '@playwright/test';

/** A later valid snapshot must not hide an earlier timeout in a healthy flow. */
export async function observeReaderTimeouts(page: Page) {
  const timeouts: string[] = [];
  await page.exposeFunction('recordReaderTimeout', (path: string) => { timeouts.push(path); });
  await page.addInitScript(() => {
    document.addEventListener('DOMContentLoaded', () => {
      let recorded = false;
      const inspect = () => {
        if (recorded || ![...document.querySelectorAll('[role="alert"]')].some(node => /timed out|thời gian chờ/i.test(node.textContent ?? ''))) return;
        recorded = true;
        const report = Reflect.get(window, 'recordReaderTimeout') as (path: string) => Promise<void>;
        void report(location.pathname).catch(() => undefined);
      };
      new MutationObserver(inspect).observe(document.body, { childList: true, subtree: true, characterData: true });
      inspect();
    });
  });
  return timeouts;
}
