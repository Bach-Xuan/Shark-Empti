import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { FieldValue, getFirestore } from 'firebase-admin/firestore';
import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { jobMessages } from '../../src/lib/i18n/jobs';
import { RECEIPT_STORAGE_KEY } from '../../src/lib/account-receipt';
import { accessibilityViolations } from './accessibility';

test('account status recovers a transient read failure without creating or replaying jobs', async ({ page, faultRoutes }) => {
  await signInDemo(page);
  let reads = 0;
  const mutations: string[] = [];
  page.on('request', request => { if (new URL(request.url()).pathname === '/api/account/jobs' && request.method() !== 'GET') mutations.push(request.method()); });
  faultRoutes.set('/api/account/jobs', async route => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: { code: 'APP-UNAVAILABLE' } });
    await route.continue();
  });
  await page.goto('/account/data');
  await expect(page.getByText(jobMessages.en.recovering, { exact: true })).toBeVisible();
  await expect(page.getByText(jobMessages.en.unavailable, { exact: true })).toBeVisible();
  expect(reads).toBe(2); expect(mutations).toEqual([]);
});

test('a public receipt recovers and follows real demo status after Auth is absent, then stops event wakes', async ({ page, faultRoutes }) => {
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const id = randomUUID(), credential = randomBytes(32).toString('base64url'), path = '/api/account/jobs/' + id;
  const record = db.doc('_accountJobs/' + id), now = Date.now();
  await record.set({ kind: 'deletion', ownerUid: 'polling-fixture-owner', status: 'running', environment: 'test', cursor: { phase: 0 }, artifacts: [], processed: 0,
    createdAtMs: now, updatedAtMs: now, nextRunAtMs: 0, expiresAtMs: now + 3600000, receiptHash: createHash('sha256').update(credential).digest('hex') });
  let reads = 0;
  const requests: Array<{ method: string; url: string }> = [];
  page.on('request', request => { if (new URL(request.url()).pathname === path) requests.push({ method: request.method(), url: request.url() }); });
  faultRoutes.set(path, async route => {
    reads++;
    if (reads === 1) return route.fulfill({ status: 503, json: { code: 'APP-UNAVAILABLE' } });
    await route.continue();
  });
  try {
    await page.goto('/account/status');
    await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), { key: RECEIPT_STORAGE_KEY, value: { id, receipt: credential } });
    await page.reload();
    await expect(page.getByText(jobMessages.en.recovering, { exact: true })).toBeVisible();
    await expect(page.getByText(jobMessages.en.status.running, { exact: true })).toBeVisible();
    await record.update({ status: 'completed', ownerUid: FieldValue.delete() });
    await expect(page.getByText(jobMessages.en.status.completed, { exact: true })).toBeVisible();
    const extra = page.waitForRequest(request => new URL(request.url()).pathname === path, { timeout: 6000 });
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); window.dispatchEvent(new Event('focus')); document.dispatchEvent(new Event('visibilitychange')); });
    await expect(extra).rejects.toThrow(/Timeout/);
    expect(reads).toBe(3);
    for (const lang of ['en', 'vi'] as const) {
      await page.context().addCookies([{ name: 'shark_preferences', value: 'v1.' + lang + '.light', url: 'http://127.0.0.1:9002' }]);
      await page.goto('/account/status');
      await expect(page.getByText(jobMessages[lang].status.completed, { exact: true })).toBeVisible();
      expect(await accessibilityViolations(page)).toEqual([]);
    }
    expect(reads).toBe(5);
    expect(requests.every(request => request.method === 'GET' && !request.url.includes(credential))).toBe(true);
  } finally { await record.delete(); }
});
