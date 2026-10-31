import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { jobMessages } from '../../src/lib/i18n/jobs';

test('unconfigured background services stay disabled and old review requests never become deletion commands', async ({ page }) => {
  test.setTimeout(180000);
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' });
  const db = getFirestore(app);
  const before = new Set((await db.collection('users').get()).docs.map(document => document.id));
  await signInDemo(page);
  const owners = (await db.collection('users').get()).docs.filter(document => !before.has(document.id));
  expect(owners).toHaveLength(1);
  const uid = owners[0].id;
  await db.doc('_accountRequests/legacy-' + uid).set({ uid, kind: 'deletion', status: 'pending_operator' });
  for (const lang of ['en', 'vi'] as const) {
    await page.context().addCookies([{ name: 'shark_preferences', value: 'v1.' + lang + '.light', url: 'http://127.0.0.1:9002' }]);
    await page.goto('/profile');
    const copy = jobMessages[lang];
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible();
    await expect(page.getByText(copy.unavailable, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: copy.export, exact: true })).toBeDisabled();
    await page.getByRole('checkbox', { name: copy.confirm, exact: true }).check();
    await expect(page.getByRole('button', { name: copy.deletion, exact: true })).toBeDisabled();
    expect((await db.doc('users/' + uid).get()).exists).toBe(true);
    expect((await getAuth(app).getUser(uid)).uid).toBe(uid);
    expect((await db.collection('_accountJobs').where('ownerUid', '==', uid).get()).empty).toBe(true);
  }
});
