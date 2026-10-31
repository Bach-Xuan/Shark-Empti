import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { translations } from '../../src/lib/translations';
import { uiMessage } from '../../src/lib/i18n';
import { history } from '../fixtures/quiz';

for (const mode of ['flashcards', 'practice'] as const) {
  test(`${mode} restores progress without another generation or archive`, async ({ page }) => {
    test.setTimeout(180000);
    const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
    const ownersBefore = new Set((await db.collection('users').get()).docs.map(document => document.id));
    await signInDemo(page);
    const owners = (await db.collection('users').get()).docs.filter(document => !ownersBefore.has(document.id));
    expect(owners).toHaveLength(1);
    const uid = owners[0].id;
    await db.doc(`users/${uid}/history/recovery-source`).set({
      ...history, date: Timestamp.fromMillis(history.date), userId: uid, schemaVersion: 2,
      quizResults: [{ ...history.quizResults[0], userAnswer: '3', isCorrect: false }],
    });
    const creations: string[] = [];
    page.on('request', request => {
      if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/ai/generations') creations.push(request.url());
    });
    const open = async () => {
      await page.evaluate(() => localStorage.setItem('shark_help_playground_seen', 'true'));
      await page.getByRole('navigation', { name: uiMessage('en', 'navigation.main') }).getByRole('button', { name: translations.en.playground, exact: true }).click();
      await page.getByRole('tab', { name: translations.en[mode], exact: true }).click();
    };
    await page.goto('/');
    await open();
    await page.getByRole('button', { name: 'Addition', exact: true }).click();
    await page.getByRole('spinbutton').fill('2');
    await page.getByRole('button', { name: mode === 'flashcards' ? translations.en.startLearning : translations.en.startPractice, exact: true }).click();
    if (mode === 'flashcards') {
      await page.getByRole('button', { name: translations.en.nextCard, exact: true }).click();
      await page.getByRole('button', { name: uiMessage('en', 'playgroundview.tap_to_reveal'), exact: true }).click();
      await expect.poll(async () => (await db.collection(`users/${uid}/flashcards`).get()).size).toBe(1);
    } else {
      await page.getByRole('button', { name: '4', exact: true }).click();
      await page.getByRole('button', { name: translations.en.continue, exact: true }).click();
    }
    const progress = () => page.evaluate(kind => {
      const key = Object.keys(sessionStorage).find(name => name.startsWith('shark:draft:v1:') && name.endsWith(`:${kind}`));
      return key ? JSON.parse(sessionStorage.getItem(key)!).data : null;
    }, mode);
    await expect.poll(async () => (await progress())?.index).toBe(1);
    const before = await progress();
    const paidCreates = creations.length;
    page.once('dialog', dialog => dialog.accept());
    await page.reload();
    await open();
    await expect(page.getByText('Progress restored in this tab.', { exact: true })).toBeVisible();
    const restored = await progress();
    expect(restored.index).toBe(1);
    expect(creations).toHaveLength(paidCreates);
    if (mode === 'flashcards') {
      expect(restored.flipped).toBe(true);
      await expect(page.getByRole('button', { name: uiMessage('en', 'playgroundview.reverse'), exact: true })).toHaveAttribute('aria-pressed', 'true');
      expect((await db.collection(`users/${uid}/flashcards`).get()).size).toBe(1);
      expect((await db.collection(`users/${uid}/flashcards`).get()).docs[0].get('createdAt')).toBeInstanceOf(Timestamp);
      await page.getByRole('button', { name: translations.en.finishSession, exact: true }).click();
    } else {
      expect(restored.id).toBe(before.id);
      expect(restored.answers).toHaveLength(1);
      await page.getByRole('button', { name: '4', exact: true }).click();
      await page.getByRole('button', { name: translations.en.finish, exact: true }).click();
      await expect(page.getByText('100%', { exact: true })).toBeVisible();
      const sessions = await db.collection(`users/${uid}/practice`).get();
      expect(sessions.size).toBe(1);
      expect(sessions.docs[0].id).toBe(before.id);
      expect(sessions.docs[0].get('createdAt')).toBeInstanceOf(Timestamp);
      expect(sessions.docs[0].get('userAnswers')).toHaveLength(2);
    }
    await expect.poll(progress).toBeNull();
  });
}
