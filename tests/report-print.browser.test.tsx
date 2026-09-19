// @vitest-environment node
import { renderToStaticMarkup } from 'react-dom/server';
import { chromium, firefox, webkit, type Browser } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { ProfilePrintDocument } from '@/components/profile-print-report';
import { calculateDashboardStats } from '@/lib/stats-utils';
import { translations } from '@/lib/translations';
import { history } from './fixtures/quiz';

// Explicit opt-in keeps unit runs independent of installed browser binaries.
// REPORT_PRINT_BROWSER=chrome|msedge|chromium|firefox|webkit
const browserName = process.env.REPORT_PRINT_BROWSER;
const katexPath = resolve('node_modules/katex/dist/katex.min.css');
const katexCss = readFileSync(katexPath, 'utf8').replace(/url\(([^)]+)\)/g, (_, path: string) => {
  const file = resolve(dirname(katexPath), path.replace(/["']/g, ''));
  return `url(data:font/${file.endsWith('.woff2') ? 'woff2' : file.endsWith('.woff') ? 'woff' : 'ttf'};base64,${readFileSync(file).toString('base64')})`;
});
let browser: Browser;
beforeAll(async () => {
  if (!browserName) return;
  const engine = browserName === 'firefox' ? firefox : browserName === 'webkit' ? webkit : chromium;
  browser = await engine.launch({ ...(browserName === 'chrome' || browserName === 'msedge' ? { channel: browserName } : {}) });
});
afterAll(async () => { await browser?.close(); });

it.skipIf(!browserName).each(['en', 'vi'] as const)('prints long %s reports in both themes with unrestricted page flow', async lang => {
  const long = lang === 'vi' ? 'Luyện tập phân tích và giải thích từng bước để hiểu rõ khái niệm. ' : 'Practice explaining each step and checking the reasoning carefully. ';
  const math = String.raw`$$\begin{aligned} S_n &= \sum_{k=1}^{n}\frac{k(k+1)}{2} \\ &= \frac{1}{2}\left(\frac{n(n+1)(2n+1)}{6}+\frac{n(n+1)}{2}\right) \\ &= \frac{n(n+1)(n+2)}{6}\end{aligned}$$`;
  const inlineMath = (`${long} ` + String.raw`$\frac{-b\pm\sqrt{b^2-4ac}}{2a}$ `).repeat(8);
  const sessions = Array.from({ length: 3 }, (_, index) => ({
    ...history, id: `session-${index}`, config: { ...history.config, topic: `TOPIC-${index}` },
    analysis: { ...history.analysis!,
      en: { strengths: [inlineMath, math], weaknesses: [long.repeat(80)], recommendations: [`START-${index} ${long.repeat(100)} END-${index}`] },
      vi: { strengths: [inlineMath, math], weaknesses: [long.repeat(80)], recommendations: [`START-${index} ${long.repeat(100)} END-${index}`] },
    },
  }));
  const stats = calculateDashboardStats(sessions, translations[lang], lang)!;
  const markup = renderToStaticMarkup(<ProfilePrintDocument stats={stats} roadmapStatus={{}} name="Print verification" issued="19/09/2026" t={translations[lang]} lang={lang} />);
  const page = await browser.newPage({ viewport: { width: 794, height: 1123 } });
  try {
    for (const theme of ['light', 'dark']) {
      await page.setContent(`<!doctype html><html class="${theme}"><head><meta charset="utf-8"><style>*{margin:0;padding:0}h1,h2,h3{font-size:inherit;font-weight:inherit}ul{list-style:none}html,body{height:100vh;overflow:hidden}.dark{color:white;background:black}${katexCss}</style></head><body style="overflow:hidden"><main>APPLICATION-NOT-PRINTED</main><div role="dialog" style="position:fixed;height:80vh;overflow:hidden">DIALOG-NOT-PRINTED</div>${markup}</body></html>`);
      await page.evaluate(() => document.fonts.ready);
      await page.emulateMedia({ media: 'screen' });
      await expect.poll(() => page.locator('.profile-print-report').isVisible()).toBe(false);
      await page.emulateMedia({ media: 'print' });
      expect(await page.locator('main').isVisible()).toBe(false);
      expect(await page.getByRole('dialog').isVisible()).toBe(false);
      const layout = await page.locator('.profile-print-report').evaluate(report => ({
        parent: report.parentElement?.tagName, height: report.getBoundingClientRect().height,
        width: report.scrollWidth, available: report.clientWidth,
        overflow: getComputedStyle(report).overflow, color: getComputedStyle(report).color,
        topicBreaks: [...report.querySelectorAll('.report-topic')].map(topic => getComputedStyle(topic).breakBefore),
      }));
      expect(layout.parent).toBe('BODY');
      expect(layout.height).toBeGreaterThan(3 * 1123);
      expect(layout.width).toBeLessThanOrEqual(layout.available);
      expect(layout.overflow).toBe('visible');
      expect(layout.color).toBe('rgb(17, 17, 17)');
      expect(layout.topicBreaks).toEqual(['page', 'page', 'page']);
      expect(await page.getByText(/END-2/).isVisible()).toBe(true);
      if (browser.browserType().name() === 'chromium') {
        await mkdir(resolve('tmp/pdfs'), { recursive: true });
        const pdf = await page.pdf({ path: resolve(`tmp/pdfs/report-${browserName}-${lang}-${theme}.pdf`), preferCSSPageSize: true });
        expect((pdf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(3);
      }
    }
  } finally { await page.close(); }
}, 60000);
