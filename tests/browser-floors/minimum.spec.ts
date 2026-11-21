import { expect, test } from '@playwright/test';
import { launchMinimumBrowser } from './installation';
import { allowedVerificationRequest } from '../e2e/network-policy';
import { serviceMessages } from '../../src/lib/i18n/service';
import { translations } from '../../src/lib/translations';

const origin = 'http://127.0.0.1:9002';
const mobileUserAgents = {
  chromium: 'Mozilla/5.0 (Linux; Android 12; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/96.0.0.0 Mobile Safari/537.36',
  firefox: 'Mozilla/5.0 (Android 12; Mobile; rv:96.0) Gecko/96.0 Firefox/96.0',
  webkit: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.2 Mobile/15E148 Safari/604.1',
};

for (const engine of ['chromium', 'firefox', 'webkit'] as const) {
  for (const mobile of [false, true]) {
    test(`${engine} minimum engine, ${mobile ? 'touch viewport' : 'desktop'}`, async ({}, info) => {
      test.setTimeout(150_000);
      const browser = await launchMinimumBrowser(engine);
      try {
        info.annotations.push({ type: 'engine', description: browser.version() });
        const context = await browser.newContext({
          viewport: mobile ? { width: 393, height: 851 } : { width: 1280, height: 900 },
          colorScheme: 'light', hasTouch: mobile, ...(engine !== 'firefox' ? { isMobile: mobile } : {}),
          ...(mobile ? { userAgent: mobileUserAgents[engine] } : {}),
        });
        context.setDefaultTimeout(25_000);
        await context.route('**/*', route => {
          const req = route.request();
          return allowedVerificationRequest(req.url(), req.method(), req.resourceType()) ? route.continue() : route.abort();
        });
        const errors: string[] = [];
        const page = await context.newPage();
        page.on('pageerror', error => { errors.push(error.message); console.error('Browser page error:', error.message); });
        await page.goto(origin + '/contact');
        if (mobile) expect(await page.evaluate(() => navigator.userAgent)).toBe(mobileUserAgents[engine]);
        await page.locator('select').selectOption('vi');
        await expect.poll(() => page.locator('h1').textContent()).toBe(serviceMessages.vi.contact.title);
        await page.locator('select').selectOption('en');
        await page.locator('button[aria-label="Toggle theme"]').click();
        await expect.poll(() => page.locator('html').evaluate(el => el.classList.contains('dark'))).toBe(true);
        const layout = await page.evaluate(() => ({
          width: innerWidth, contentWidth: document.documentElement.scrollWidth,
          rem: parseFloat(getComputedStyle(document.documentElement).fontSize),
        }));
        expect(layout.rem).toBeCloseTo(mobile ? 16 : 12.8);
        expect(layout.contentWidth).toBeLessThanOrEqual(layout.width + 1);
        await expect.poll(() => page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgb(16, 19, 24)');

        await page.goto(origin + '/login');
        await page.locator('input[type=checkbox]').check();
        const signIn = page.locator('button:has-text("Google")');
        await expect.poll(() => signIn.isEnabled()).toBe(true);
        // Historical Gecko and WebKit can deliver real touch events while reporting zero maxTouchPoints.
        const touchStart = mobile ? signIn.evaluate(button => new Promise<boolean>(resolve => {
          button.addEventListener('touchstart', event => resolve(event.isTrusted), { once: true });
        })) : undefined;
        const [popup, , trustedTouch] = await Promise.all([page.waitForEvent('popup'), mobile ? signIn.tap() : signIn.click(), touchStart]);
        if (mobile) expect(trustedTouch).toBe(true);
        await popup.locator('text=Add new account').click();
        await popup.locator('text=Auto-generate user information').click();
        await popup.locator('button:has-text("Sign in with Google")').click();
        await page.waitForSelector('text=Before you continue');
        await page.locator('input[type=checkbox], [role=checkbox]').first().click();
        await page.locator('button:has-text("Confirm and continue")').click();
        await page.locator('button:has-text("Got it")').first().click();
        await page.locator('button[aria-label="Minimize chat"]').click();
        await page.locator('#setup-topic').fill('Addition');
        await page.locator('input[aria-label="Number of Questions"]').fill('1');
        await page.locator('button:has-text("Start learning")').click();
        await page.waitForSelector('text=2 + 2 = ?');
        await page.locator('button:has(:text-is("4"))').click();
        const saved = page.waitForResponse(response =>
          response.url().includes('/api/learning/history/') && response.request().method() === 'PUT');
        await page.locator('button:has-text("Finish"), button:has-text("Results")').first().click();
        expect((await saved).status()).toBe(201);
        await page.waitForSelector('text=100%');
        await page.locator(`button[aria-label="${translations.en.profile}"]`).click();
        await page.locator(`button:has-text("${translations.en.exportReport}")`).click();
        const reportSession = '[role="dialog"] input[type="checkbox"]';
        await page.waitForSelector(reportSession);
        const session = page.locator(reportSession).first();
        expect(await session.getAttribute('aria-label')).toContain('Addition');
        await session.click();
        await page.locator(`button:has-text("${translations.en.generateReport}")`).click();
        const print = page.locator(`[role="dialog"] button[aria-label="${translations.en.printReport}"]`);
        await expect.poll(() => print.isEnabled()).toBe(true);
        expect(errors).toEqual([]);
      } finally {
        await browser.close();
      }
    });
  }
}
