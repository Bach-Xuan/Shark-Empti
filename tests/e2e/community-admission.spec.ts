import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { randomUUID } from 'node:crypto';
import { errorMessages } from '../../src/lib/i18n/errors';

test('real traffic rejection retains a Forum draft and permits one successful retry after admission recovers', async ({ page }) => {
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  await signInDemo(page);
  const budget = db.doc('_requestBudgets/community-traffic_global');
  const title = 'Admission ' + randomUUID();
  await budget.set({ tokens: 0, updatedAtMs: Date.now() + 60000 });
  try {
    await page.evaluate(() => localStorage.setItem('shark_help_forum_seen', 'true'));
    await page.goto('/forum');
    await page.getByRole('button', { name: 'Create Post', exact: true }).click();
    const content = page.getByPlaceholder("What's on your mind?");
    await page.getByPlaceholder('Enter post title...').fill(title);
    await content.fill('Keep this draft after the server rejects admission.');
    const refused = page.waitForResponse(response => new URL(response.url()).pathname === '/api/forum' && response.request().method() === 'POST');
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    expect((await refused).status()).toBe(429);
    await expect(page.getByText(errorMessages.en.rate, { exact: false })).toBeVisible();
    await expect(content).toHaveValue('Keep this draft after the server rejects admission.');
    expect((await db.collection('posts').where('title', '==', title).get()).empty).toBe(true);
    await budget.delete();
    await page.getByRole('button', { name: 'Publish', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByText(title, { exact: true })).toBeVisible();
    expect((await db.collection('posts').where('title', '==', title).get()).size).toBe(1);
  } finally { await budget.delete(); }
});
