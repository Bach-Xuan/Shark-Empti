import { test, expect } from './fixtures';
import { signInDemo } from './auth';

test('two tabs keep the losing note draft and reload the committed text', async ({ page, context }) => {
  await signInDemo(page);
  await page.evaluate(() => localStorage.setItem('shark_help_forum_seen', 'true'));
  const forum = await context.newPage();
  await forum.goto('/forum');
  for (const tab of [page, forum]) {
    await tab.getByRole('button', { name: 'Personal Notes', exact: true }).click();
    await tab.getByRole('textbox', { name: 'Personal Notes' }).fill(tab === page ? 'Physics' : 'Chemistry');
  }
  const first = page.getByRole('dialog');
  const second = forum.getByRole('dialog');
  await first.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(first).toHaveCount(0);
  await second.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(second.getByRole('alert')).toContainText('Another editor saved changes');
  await expect(second.getByRole('textbox')).toHaveValue('Chemistry');
  await second.getByRole('button', { name: 'Load latest note' }).click();
  await expect(second.getByRole('textbox')).toHaveValue('Physics');
});
