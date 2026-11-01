import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { jobMessages } from '../../src/lib/i18n/jobs';
import { accessibilityViolations } from './accessibility';

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

test('account-data controls remain available before renewed consent and without a provisioned profile', async ({ page }) => {
  test.setTimeout(180000);
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' });
  const db = getFirestore(app);
  const before = new Set((await db.collection('users').get()).docs.map(document => document.id));
  await signInDemo(page);
  const owners = (await db.collection('users').get()).docs.filter(document => !before.has(document.id));
  expect(owners).toHaveLength(1);
  const uid = owners[0].id;
  expect((await db.doc('_serviceConsents/' + uid).get()).get('policyVersion')).toBe('2');
  await db.doc('_serviceConsents/' + uid).delete();
  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: 'Before you continue', exact: true })).toBeVisible();
  await db.doc('users/' + uid).delete();
  await page.getByRole('link', { name: 'Export or delete account data', exact: true }).click();
  await expect(page).toHaveURL('http://127.0.0.1:9002/account/data');
  for (const lang of ['en', 'vi'] as const) {
    await page.context().addCookies([{ name: 'shark_preferences', value: 'v1.' + lang + '.light', url: 'http://127.0.0.1:9002' }]);
    await page.goto('/account/data');
    await expect(page.getByRole('heading', { name: lang === 'en' ? 'Account data' : 'Dữ liệu tài khoản', exact: true })).toBeVisible();
    await expect(page.getByText(jobMessages[lang].unavailable, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: jobMessages[lang].export, exact: true })).toBeDisabled();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    expect(await accessibilityViolations(page)).toEqual([]);
  }
  expect((await db.doc('users/' + uid).get()).exists).toBe(false);
  expect((await db.doc('_serviceConsents/' + uid).get()).exists).toBe(false);
});
