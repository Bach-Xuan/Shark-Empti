import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { readFileSync } from 'node:fs';
import { accountMessages } from '../../src/lib/i18n/account';

test('learning export downloads owner data and deletion review never deletes the account', async ({ page }) => {
  test.setTimeout(180000);
  const app = getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' });
  const db = getFirestore(app);
  const ownersBefore = new Set((await db.collection('users').get()).docs.map(document => document.id));
  await signInDemo(page);
  const owners = (await db.collection('users').get()).docs.filter(document => !ownersBefore.has(document.id));
  expect(owners).toHaveLength(1);
  const uid = owners[0].id;
  await db.doc(`users/${uid}/notes/export-fixture`).set({ text: 'Private demo export', updatedAt: Timestamp.now() });
  for (const lang of ['en', 'vi'] as const) {
    await page.evaluate(lang => { localStorage.setItem('shark_lang', lang); window.dispatchEvent(new Event('storage')); }, lang);
    await page.goto('/profile');
    const copy = accountMessages[lang];
    await expect(page.getByRole('heading', { name: copy.title, exact: true })).toBeVisible();
    const downloading = page.waitForEvent('download');
    await page.getByRole('button', { name: copy.download, exact: true }).click();
    const download = await downloading;
    const file = await download.path();
    expect(file).not.toBeNull();
    const exported = JSON.parse(readFileSync(file!, 'utf8'));
    expect(exported.format).toBe('shark-learning-data-v1');
    expect(exported.complete).toBe(true);
    expect(exported.pages).toHaveLength(6);
    expect(exported.pages.every((part: { uid: string }) => part.uid === uid)).toBe(true);
    expect(JSON.stringify(exported)).toContain('Private demo export');
    expect(JSON.stringify(exported)).not.toMatch(/refreshToken|passwordHash|private_key/);
    await download.delete();
    await expect(page.getByText(copy.done, { exact: true })).toBeVisible();
    page.once('dialog', dialog => dialog.accept());
    await page.getByRole('button', { name: copy.deletion, exact: true }).click();
    await expect(page.getByText(copy.saved, { exact: true })).toBeVisible();
    expect((await db.doc(`users/${uid}`).get()).exists).toBe(true);
    expect((await getAuth(app).getUser(uid)).uid).toBe(uid);
  }
});
