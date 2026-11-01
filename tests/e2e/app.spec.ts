import { expect, test } from './fixtures';
import { publishForumFixture } from './community-fixtures';
import { signInDemo as signIn } from './auth';
import { randomUUID } from 'node:crypto';
import { getApps,initializeApp } from 'firebase-admin/app';
import { getFirestore,Timestamp } from 'firebase-admin/firestore';
test('account isolation, quiz, history, notes and preferences', async ({ page }) => {
  test.setTimeout(180000);
  await signIn(page);
  await expect(page.getByRole('button', { name: /start learning/i })).toBeVisible();
  await page.getByPlaceholder('e.g. Calculus, Redox reactions...').fill('Addition');
  await page.getByRole('textbox', { name: 'Number of Questions' }).fill('1');
  await page.getByRole('button', { name: /start learning/i }).click();
  await expect(page.getByText('2 + 2 = ?', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '4', exact: true }).click();
  await page.getByRole('button', { name: /finish|results/i }).click();
  await expect(page.getByRole('heading', { name: /100%/ })).toBeVisible();
  await page.screenshot({ path: `test-results/result-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Personal Notes', exact: true }).click();
  await page.getByPlaceholder('Write your study notes or reminders here...').fill('Private first account note');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.evaluate(() => localStorage.setItem('shark_help_dashboard_seen', 'true'));
  await page.getByRole('navigation').getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Private first account note', { exact: true }).first()).toBeVisible();
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.getByRole('button', { name: 'Toggle theme' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
  await page.getByRole('button', { name: 'Language', exact: true }).click();
  await page.getByRole('menuitem', { name: 'Tiếng Việt' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'vi');
  await page.screenshot({ path: `test-results/dashboard-vi-dark-${test.info().project.name}.png`, fullPage: true });
  await page.getByRole('button', { name: 'Ngôn ngữ', exact: true }).click();
  await page.getByRole('menuitem', { name: 'English' }).click();
  await page.goto('/profile');
  await page.getByRole('button', { name: 'Sign Out', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  // A new registration must not inherit the previous user's private notes/history.
  await page.goto('/register');
  await page.getByRole('checkbox', { name: /I confirm that I am at least 16/ }).check();
  const popupReady = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Google/i }).click();
  const popup = await popupReady; await popup.waitForLoadState('load');
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.getByText('Auto-generate user information', { exact: true }).click();
  await popup.getByRole('button', { name: /sign in with google/i }).click();
  await page.getByRole('checkbox', { name: /^I am at least 16/ }).check();
  await page.getByRole('button', { name: 'Confirm and continue' }).click();
  await expect(page).toHaveURL('http://127.0.0.1:9002/');
  await page.getByRole('button', { name: 'Personal Notes', exact: true }).click();
  await expect(page.getByPlaceholder('Write your study notes or reminders here...')).toHaveValue('');
});

test('dashboard boundary isolates a browser failure and recovers on retry', async ({ page }) => {
  await signIn(page);
  await page.evaluate(() => {
    const original = window.matchMedia.bind(window);
    window.matchMedia = query => {
      if (query === '(max-width: 767px)') {
        window.matchMedia = original;
        throw new Error('Synthetic dashboard lifecycle failure');
      }
      return original(query);
    };
  });
  await page.getByRole('navigation').getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(page.getByText('Unable to display this content.', { exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').filter({ has: page.getByRole('button', { name: 'Overview', exact: true }) })).toBeVisible();
  await page.getByRole('button', { name: 'Retry', exact: true }).click();
  await expect(page.getByText('Unable to display this content.', { exact: true })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'No history available yet.', exact: true })).toBeVisible();
});

test('Forum comment and Arena submission use real demo APIs', async ({ page, faultRoutes }) => {
  test.setTimeout(180000);
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Demo emulators required');
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const id = `browser-${test.info().project.name}-${randomUUID()}`;
  await db.doc(`posts/${id}`).set({ title: 'Browser discussion', content: 'Addition practice', subject: 'math', authorId: 'fixture', authorName: 'Fixture', authorPhoto: '', createdAt: Timestamp.now(), likesCount: 0, likedBy: [], commentsCount: 0 });
  await publishForumFixture(db.doc('posts/' + id));
  await db.doc(`arenaExams/${id}`).set({ schemaVersion: 2, questionCount: 1, title: 'Browser exam', authorId: 'fixture', authorName: 'Fixture', authorPhoto: '', createdAt: Timestamp.now(), totalAttempts: 0, config: { topic: 'Addition', subject: 'math', grade: 'none', numQuestions: '1', difficulty: 'Easy', type: 'Multiple Choice', timeLimit: '' } });
  await db.doc(`_arenaAnswerKeys/${id}`).set({ schemaVersion: 2, authorId: 'fixture', questions: [{ question: '2 + 2 = ?', correct: '4', options: ['4', '3', '2', '1'], type: 'Multiple Choice', difficulty: 'Easy', explanation: 'Addition', section: 'Addition' }] });
  let failOnce = true;
  const requestIds: string[] = [];
  faultRoutes.set(`/api/forum/${id}/comments`, async route => {
    requestIds.push(route.request().postDataJSON().requestId);
    if (failOnce) { failOnce = false; await route.abort('failed'); }
    else await route.continue();
  });
  await signIn(page);
  await page.goto(`/forum/${id}`);
  await page.getByPlaceholder('Add a comment...').fill('Browser comment');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('COULD NOT ADD COMMENT.', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('Add a comment...')).toHaveValue('Browser comment');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByText('Browser comment', { exact: true })).toBeVisible();
  expect(requestIds).toHaveLength(2);
  expect(requestIds[0]).toBe(requestIds[1]);
  await page.goto(`/arena/${id}`);
  const starts: string[] = [];
  page.on('request', request => {
    if (request.method() === 'POST' && new URL(request.url()).pathname === `/api/arena/${id}/start`) starts.push(request.postDataJSON().requestId);
  });
  await page.getByRole('button', { name: 'Start Challenge', exact: true }).click();
  await expect(page.getByRole('button', { name: '4', exact: true })).toBeVisible();
  page.once('dialog', dialog => dialog.accept());
  await page.reload();
  await expect(page.getByText(/An unfinished attempt is available/)).toBeVisible();
  await page.getByRole('button', { name: 'Start Challenge', exact: true }).click();
  await page.getByRole('button', { name: '4', exact: true }).click({ delay: 350 });
  await expect(page.getByText('Answer recorded. The server grades your answers after submission.', { exact: true })).toBeVisible();
  expect(starts).toHaveLength(2);
  expect(starts[0]).toBe(starts[1]);
  await page.getByRole('button', { name: /finish|results/i }).click();
  await expect(page.getByRole('heading', { name: /100%/ })).toBeVisible();
  expect((await db.doc(`arenaExams/${id}`).get()).get('totalAttempts')).toBe(1);
  const attempts = await db.collection(`arenaExams/${id}/attempts`).get();
  expect(attempts.size).toBe(1);
  expect(attempts.docs[0].get('timingVersion')).toBe(1);
  expect(attempts.docs[0].get('duration')).toBeGreaterThanOrEqual(1);
});
for (const language of ['en', 'vi']) {
  test(`auth pages retain ${language} across navigation without loading TensorFlow`, async ({ page }) => {
    await page.addInitScript(lang => localStorage.setItem('shark_lang', lang), language);
    const requested: string[] = [];
    page.on('request', request => requested.push(request.url()));
    await page.goto('/login');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    await expect(page.getByRole('button', { name: /Google/i })).toBeVisible();
    await page.goto('/register');
    await expect(page.locator('html')).toHaveAttribute('lang', language);
    // A held pointer must not lose a small control as its parent card moves.
    const eligibility = page.getByRole('checkbox');
    await eligibility.click({ delay: 350 });
    await expect(eligibility).toBeChecked();
    expect(requested.filter(url => /model\.json|\.bin(?:\?|$)/i.test(url))).toEqual([]);
    // Turbopack dev emits a small async-loader manifest, not the TF runtime.
    for (const url of requested.filter(url => /tensorflow/i.test(url))) {
      const source = await (await page.request.get(url)).text();
      expect(source).toContain('(ecmascript, async loader)');
      expect(Buffer.byteLength(source)).toBeLessThan(4096);
    }
    await page.screenshot({ path: `test-results/auth-${language}-${test.info().project.name}.png`, fullPage: true });
    await page.goto('/arena');
    await page.getByRole('button', { name: language === 'vi' ? 'Lá Chắn Tập Trung' : 'Focus Shield', exact: true }).click();
    await expect(page.getByRole('button', { name: language === 'vi' ? 'Thu nhỏ Lá chắn tập trung' : 'Minimize Focus Shield', exact: true })).toBeVisible();
  });
}

// No injected failures: the destination allowlist still protects all contexts.
test('Forum comment reaches the subscription without injected failures', async ({ page }) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Demo emulators required');
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const id = 'subscription-' + test.info().project.name + '-' + randomUUID();
  await db.doc('posts/' + id).set({ title: 'Direct subscription', content: 'Addition', subject: 'math', authorId: 'fixture', authorName: 'Fixture', authorPhoto: '', createdAt: Timestamp.now(), likesCount: 0, likedBy: [], commentsCount: 0 });
  await publishForumFixture(db.doc('posts/' + id));
  await signIn(page);
  await page.goto('/forum/' + id);
  await page.getByPlaceholder('Add a comment...').fill('Unintercepted comment');
  await page.getByRole('button', { name: 'Send', exact: true }).click();
  await expect(page.getByPlaceholder('Add a comment...')).toHaveValue('');
  await expect(page.getByText('Unintercepted comment', { exact: true })).toBeVisible();
  expect((await db.doc('posts/' + id).get()).get('commentsCount')).toBe(1);
});
