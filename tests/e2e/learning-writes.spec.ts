import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { uiMessage } from '../../src/lib/i18n';

test('bounded biography writes preserve creation time, server coins and unrelated legacy fields', async ({ page }) => {
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const before = new Set((await db.collection('users').get()).docs.map(row => row.id));
  await signInDemo(page);
  const owners = (await db.collection('users').get()).docs.filter(row => !before.has(row.id));
  expect(owners).toHaveLength(1);
  const ref = owners[0].ref, createdAt = owners[0].get('createdAt');
  await ref.update({ sharkCoins: 25, preservedLegacy: { private: 'Retain' } });
  await page.goto('/profile');
  const biography = page.getByPlaceholder(uiMessage('en', 'profile.tell_shark_guru_about_yourself'));
  await expect(biography).toHaveAttribute('maxlength', '20000');
  await biography.fill('A bounded learner biography');
  await page.getByRole('button', { name: uiMessage('en', 'profile.save_bio'), exact: true }).click();
  await expect.poll(async () => (await ref.get()).get('bio')).toBe('A bounded learner biography');
  const saved = (await ref.get()).data()!;
  expect(saved.createdAt.isEqual(createdAt)).toBe(true);
  expect(saved.sharkCoins).toBe(25);
  expect(saved.preservedLegacy).toEqual({ private: 'Retain' });
  await page.reload();
  await expect(biography).toHaveValue('A bounded learner biography');
});
