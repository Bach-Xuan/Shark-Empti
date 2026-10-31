import { expect, test } from './fixtures';
import { accessibilityViolations } from './accessibility';
import { serviceMessages, SERVICE_PAGES } from '../../src/lib/i18n/service';
import { publicMessages } from '../../src/lib/i18n/public';

test('service pages share local brand fonts, selected locale, responsive layout and accessible controls', async ({ page }) => {
  test.setTimeout(240000);
  const externalFonts: string[] = [];
  page.on('request', request => { if (/fonts\.(?:googleapis|gstatic)\.com/.test(request.url())) externalFonts.push(request.url()); });
  for (const lang of ['en', 'vi'] as const) for (const theme of ['light', 'dark']) {
    await page.context().addCookies([{ name: 'shark_preferences', value: 'v1.' + lang + '.' + theme, url: 'http://127.0.0.1:9002' }]);
    await page.emulateMedia({ reducedMotion: theme === 'dark' ? 'reduce' : 'no-preference' });
    await page.setViewportSize({ width: theme === 'dark' ? 320 : 1280, height: 800 });
    for (const section of SERVICE_PAGES) {
      await page.goto('/' + section);
      await expect(page.getByRole('heading', { level: 1, name: serviceMessages[lang][section].title, exact: true })).toBeVisible();
      await expect(page).toHaveTitle(serviceMessages[lang][section].title + ' | Shark Empti');
      await page.evaluate(() => document.fonts.ready);
      const fontSample = lang === 'vi' ? 'Tiếng Việt' : 'Learning';
      expect(await page.evaluate(text => document.fonts.check('16px "Inter"', text), fontSample)).toBe(true);
      expect(await page.evaluate(text => document.fonts.check('700 24px "Space Grotesk"', text), fontSample)).toBe(true);
      expect(await page.locator('html').getAttribute('lang')).toBe(lang);
      expect(await page.locator('html').evaluate(element => element.classList.contains('dark'))).toBe(theme === 'dark');
      expect(await page.locator('body').evaluate(element => getComputedStyle(element).fontFamily)).toContain('Inter');
      expect(await page.getByRole('heading', { level: 1 }).evaluate(element => getComputedStyle(element).fontFamily)).toContain('Space Grotesk');
      const footer = page.getByRole('contentinfo');
      await expect(footer.getByRole('link', { name: publicMessages[lang].nav.privacy, exact: true })).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
      expect.soft(await accessibilityViolations(page), section + '/' + lang + '/' + theme).toEqual([]);
    }
    await page.getByRole('combobox', { name: publicMessages[lang].language, exact: true }).focus();
    await expect(page.getByRole('combobox', { name: publicMessages[lang].language, exact: true })).toBeFocused();
    const alternate = lang === 'en' ? 'vi' : 'en';
    await page.getByRole('combobox').selectOption(alternate);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(serviceMessages[alternate].contact.title);
    await expect(page).toHaveTitle(serviceMessages[alternate].contact.title + ' | Shark Empti');
    await page.getByRole('combobox').selectOption(lang);
    await expect(page).toHaveTitle(serviceMessages[lang].contact.title + ' | Shark Empti');
  }
  expect(externalFonts).toEqual([]);
  await page.emulateMedia({ media: 'print' });
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByRole('contentinfo')).toBeHidden();
});
