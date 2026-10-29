import { expect, test } from './fixtures';
import { accessibilityViolations } from './accessibility';

test('responsive utilities and named keyboard controls work in both themes and languages', async ({ page }) => {
  test.setTimeout(180000);
  await page.goto('/login');
  await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
  for (const lang of ['en', 'vi']) {
    for (const theme of ['light', 'dark']) {
      await page.evaluate(({ lang, theme }) => {
        localStorage.setItem('shark_lang', lang); localStorage.setItem('shark_theme', theme);
        window.dispatchEvent(new Event('storage'));
      }, { lang, theme });
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      const language = page.getByRole('button', { name: lang === 'en' ? 'Language' : 'Ngôn ngữ', exact: true });
      const toggle = page.getByRole('button', { name: lang === 'en' ? 'Toggle theme' : 'Đổi giao diện sáng tối', exact: true });
      for (const width of [320, 390, 640, 768, 1280]) {
        await page.setViewportSize({ width, height: 900 });
        await expect.poll(() => page.evaluate(() => window.innerWidth)).toBe(width);
        await expect(language).toBeVisible(); await expect(toggle).toBeVisible();
        for (const control of [language, toggle, ...await page.getByRole('main').getByRole('button').all()]) {
          const bounds = await control.boundingBox();
          expect(bounds).not.toBeNull();
          expect(bounds!.x).toBeGreaterThanOrEqual(0);
          expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width);
        }
        // Exercise the actual emitted stylesheet, including all repaired typography tokens.
        const sizes = await page.evaluate(() => {
          const classes = ['text-[9px] md:text-sm', 'text-xs md:text-lg', 'text-xs md:text-base', 'text-[9px] md:text-xs', 'text-[8px] md:text-[10px]', 'hidden sm:inline'];
          return classes.map(className => {
            const node = document.createElement('span'); node.className = className;
            node.textContent = 'Nội dung tiếng Việt dài để kiểm tra hiển thị'; document.body.append(node);
            const style = getComputedStyle(node); const result = [style.fontSize, style.display]; node.remove(); return result;
          });
        });
        const rem = await page.evaluate(() => parseFloat(getComputedStyle(document.documentElement).fontSize));
        const expected = width >= 768 ? [0.875 * rem, 1.125 * rem, rem, 0.75 * rem, 10] : [9, 0.75 * rem, 0.75 * rem, 9, 8];
        sizes.slice(0, 5).forEach((style, index) => expect(parseFloat(style[0])).toBeCloseTo(expected[index], 2));
        expect(sizes[5][1]).toBe(width >= 640 ? 'inline' : 'none');
      }
      await language.focus(); await page.keyboard.press('Enter');
      await expect(page.getByRole('menu')).toBeVisible();
      await page.keyboard.press('Escape'); await expect(language).toBeFocused();
      await page.keyboard.press('Tab'); await expect(toggle).toBeFocused();
      await page.keyboard.press('Shift+Tab'); await expect(language).toBeFocused();
      const violations = await accessibilityViolations(page, ['button-name', 'link-name', 'nested-interactive', 'aria-valid-attr', 'aria-valid-attr-value', 'color-contrast', 'image-alt', 'label', 'landmark-one-main', 'page-has-heading-one']);
      expect(violations).toEqual([]);
    }
  }
});
