import { observeReaderTimeouts } from './reader-timeouts';
import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { translations } from '../../src/lib/translations';
import { uiMessage } from '../../src/lib/i18n';

test('recovered feedback survives a denied save, reaches the same History/Dashboard/report, and is not generated twice', async ({ page, faultRoutes }) => {
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const before = new Set((await db.collection('users').get()).docs.map(document => document.id));
  await signInDemo(page);
  const owners = (await db.collection('users').get()).docs.filter(document => !before.has(document.id));
  expect(owners).toHaveLength(1);
  const uid = owners[0].id, lock = db.doc('_accountLocks/' + uid);
  let feedbackUnavailable = true, generations = 0;
  faultRoutes.set('/api/ai/generations', async route => {
    const input = route.request().postDataJSON();
    if (input.operation !== 'personalized-quiz-feedback') return route.continue();
    if (feedbackUnavailable) return route.fulfill({ status: 400, json: { code: 'AI-REQUEST-FAILED', error: 'Synthetic feedback failure' } });
    generations++;
    faultRoutes.set('/api/ai/generations/' + input.generationId + '/attempt', async attempt => {
      const response = await attempt.fetch();
      const value = await response.json();
      // The real response is complete before the unmodified owner Rules deny its merge.
      if (value.state === 'succeeded') await lock.set({ status: 'synthetic-save-failure' });
      await attempt.fulfill({ response, json: value });
    });
    await route.continue();
  });
  try {
    await page.getByPlaceholder('e.g. Calculus, Redox reactions...').fill('Addition');
    await page.getByRole('textbox', { name: 'Number of Questions' }).fill('1');
    await page.getByRole('button', { name: /start learning/i }).click();
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: /finish|results/i }).click();
    const retry = page.getByRole('button', { name: uiMessage('en', 'resultview.retry'), exact: true });
    await expect(retry).toBeVisible();
    const saved = await db.collection('users/' + uid + '/history').get();
    expect(saved.size).toBe(1);
    const completedAt = saved.docs[0].get('date').toMillis();
    const historyRef = saved.docs[0].ref;
    feedbackUnavailable = false;
    await retry.click();
    await expect.poll(() => generations).toBe(1);
    await expect.poll(async () => (await lock.get()).exists).toBe(true);
    await expect(retry).toBeVisible();
    expect((await historyRef.get()).get('analysis')).toBeUndefined();
    expect(generations).toBe(1);
    await lock.delete();
    await retry.click();
    await expect(page.getByText('Practice daily', { exact: true }).first()).toBeVisible();
    expect(generations).toBe(1);
    expect((await db.collection('users/' + uid + '/history').get()).size).toBe(1);
    expect((await historyRef.get()).get('analysis.en.recommendations')).toEqual(['Practice daily']);
    expect((await historyRef.get()).get('analysis.vi.recommendations')).toEqual(['Luyện tập hằng ngày']);
    expect((await historyRef.get()).get('date').toMillis()).toBe(completedAt);
    await page.evaluate(() => localStorage.setItem('shark_help_dashboard_seen', 'true'));
    await page.getByRole('navigation', { name: uiMessage('en', 'navigation.main') }).getByRole('button', { name: translations.en.dashboard, exact: true }).click();
    await expect(page.getByText('Practice daily', { exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'Language', exact: true }).click();
    await page.getByRole('menuitem', { name: 'Tiếng Việt', exact: true }).click();
    const readerTimeouts = await observeReaderTimeouts(page);
    await page.goto('/profile');
    await page.getByRole('button', { name: translations.vi.exportReport, exact: true }).click();
    await page.getByRole('checkbox', { name: /Phép cộng/ }).check();
    await page.getByRole('button', { name: translations.vi.generateReport, exact: true }).click();
    const report = page.getByRole('dialog');
    await expect(report.getByText('Luyện tập hằng ngày', { exact: true }).first()).toBeVisible();
    await expect(report.getByText('Practice daily', { exact: true })).toHaveCount(0);
    await expect(report.getByRole('button', { name: translations.vi.printReport, exact: true })).toBeEnabled();
    expect(readerTimeouts).toEqual([]);
  } finally { await lock.delete(); }
});
