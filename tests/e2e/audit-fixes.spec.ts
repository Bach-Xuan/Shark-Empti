import { test, expect } from '@playwright/test';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

test('guest Arena requires login and publishing a post waits for a real write', async ({ page }) => {
  if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) throw new Error('Demo emulators required');
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  const id = `guard-${test.info().project.name}`;
  await db.doc(`arenaExams/${id}`).set({
    title: 'Guard exam', authorId: 'fixture', authorName: 'Fixture', authorPhoto: '', createdAt: Timestamp.now(), totalAttempts: 0,
    config: { topic: 'Addition', subject: 'math', grade: 'none', numQuestions: '1', difficulty: 'Recognition', type: 'Multiple Choice', timeLimit: '' },
    questions: [{ question: '2+2?', correct: '4', options: ['4', '3', '2', '1'], type: 'Multiple Choice', difficulty: 'Recognition', explanation: 'Addition', section: 'Addition' }],
  });
  await page.goto(`/arena/${id}`);
  await page.getByRole('button', { name: 'Sign in to start', exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
  expect((await db.doc(`arenaExams/${id}`).get()).get('totalAttempts')).toBe(0);

  const popupReady = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Google/i }).click();
  const popup = await popupReady;
  await popup.waitForLoadState('load');
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.getByText('Auto-generate user information', { exact: true }).click();
  await popup.getByRole('button', { name: /sign in with google/i }).click();
  await expect(page).toHaveURL('http://127.0.0.1:9002/');
  await page.getByRole('button', { name: 'GOT IT', exact: true }).click();
  await page.evaluate(() => localStorage.setItem('shark_help_forum_seen', 'true'));
  await page.goto('/forum');
  await page.getByRole('button', { name: 'Create Post', exact: true }).click();
  const title = page.getByPlaceholder('Enter post title...');
  const content = page.getByPlaceholder("What's on your mind?");
  const postTitle = `Published ${id}`;
  await title.fill(postTitle);
  await content.fill('Verified browser draft');
  await page.getByRole('button', { name: 'Publish', exact: true }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByText(postTitle, { exact: true })).toBeVisible();
  expect((await db.collection('posts').where('title', '==', postTitle).get()).size).toBe(1);
  await page.getByRole('button', { name: 'Create Post', exact: true }).click();
  await expect(title).toHaveValue('');
  await expect(content).toHaveValue('');
});
