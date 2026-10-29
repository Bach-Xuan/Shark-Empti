import type { Page } from '@playwright/test';
import { createRequire } from 'node:module';

const localRequire = createRequire(`${process.cwd()}/package.json`);

export async function accessibilityViolations(page: Page, rules?: string[]) {
  // Measure stable text, not intermediate fade/colour transitions. Infinite
  // decorative effects must not make accessibility verification hang.
  await page.evaluate(async () => {
    const finite = document.getAnimations().filter(animation =>
      animation.playState === 'running' && animation.effect?.getComputedTiming().iterations !== Infinity,
    );
    await Promise.all(finite.map(animation => animation.finished.catch(() => undefined)));
  });
  await page.addScriptTag({ path: localRequire.resolve('axe-core/axe.min.js') });
  return page.evaluate(async (selectedRules) => {
    const axe = (window as unknown as {
      axe: { run: (options: unknown) => Promise<{ violations: Array<{
        id: string;
        nodes: Array<{ target: string[]; html: string; failureSummary: string }>;
      }> }> };
    }).axe;
    const runOnly = selectedRules
      ? { type: 'rule', values: selectedRules }
      : { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] };
    return (await axe.run({ runOnly })).violations.map(item => ({
      id: item.id,
      nodes: item.nodes.slice(0, 6).map(node => ({ target: node.target, html: node.html, failure: node.failureSummary })),
    }));
  }, rules);
}
