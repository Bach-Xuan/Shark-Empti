import { expect, test } from './fixtures';

test('ordinary and nested unknown routes return 404 and support keyboard recovery', async ({ page }) => {
  for (const path of ['/missing-recovery-page', '/forum/unknown/nested']) {
    const response = await page.goto(path);
    expect(response?.status()).toBe(404);
    const main = page.getByRole('main');
    await expect(main).toHaveCount(1);
    await expect(main.getByRole('heading', { level: 1 })).toHaveCount(1);
    const home = main.locator('a[href="/"]');
    const about = main.locator('a[href="/about"]');
    await home.focus();
    await expect(home).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(about).toBeFocused();
    await page.keyboard.press('Shift+Tab');
    await expect(home).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL('http://127.0.0.1:9002/');
  }
});
