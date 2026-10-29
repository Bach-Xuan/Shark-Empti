import { expect, test } from './fixtures';
import { signInDemo } from './auth';
import { accessibilityViolations } from './accessibility';
import { getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { translations } from '../../src/lib/translations';
import { uiMessage } from '../../src/lib/i18n';
import { SUBJECT_IDS } from '../../src/lib/subjects';
import { accountMessages } from '../../src/lib/i18n/account';

test('full accessibility checks cover Setup, community lists and expanded landscape chat in both locales/themes', async ({ page }) => {
  test.setTimeout(240000);
  const db = getFirestore(getApps()[0] ?? initializeApp({ projectId: 'demo-shark-empti' }));
  for (const subject of SUBJECT_IDS) {
    await db.doc(`posts/a11y-${test.info().project.name}-${subject}`).set({ title: `Accessible discussion ${subject}`, content: 'A public learning discussion.', subject, authorId: 'fixture', authorName: 'Fixture', authorPhoto: 'http://127.0.0.1:9002/opengraph-image', createdAt: Timestamp.now(), likesCount: 0, commentsCount: 0, likedBy: [] });
  }
  await signInDemo(page);
  const scan = async (state: string) => {
    await expect(page.getByRole('main')).toHaveCount(1);
    await expect(page.getByRole('main').getByRole('heading', { level: 1 })).toHaveCount(1);
    expect.soft(await accessibilityViolations(page), state).toEqual([]);
  };
  for (const lang of ['en', 'vi'] as const) for (const theme of ['light', 'dark']) {
    await page.emulateMedia({ reducedMotion: theme === 'dark' ? 'reduce' : 'no-preference' });
    await page.evaluate(({ lang, theme }) => {
      localStorage.setItem('shark_lang', lang); localStorage.setItem('shark_theme', theme);
      window.dispatchEvent(new Event('storage'));
    }, { lang, theme });
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/');
    await expect(page.getByLabel(translations[lang].numQuestions, { exact: true })).toBeVisible();
    await scan(`Setup ${lang}/${theme}`);
    await page.evaluate(() => localStorage.setItem('shark_help_dashboard_seen', 'true'));
    await page.getByRole('navigation', { name: uiMessage(lang, 'navigation.main') }).getByRole('button', { name: translations[lang].dashboard, exact: true }).click();
    await expect(page.getByRole('heading', { name: translations[lang].noHistory, exact: true })).toBeVisible();
    await scan(`Empty dashboard ${lang}/${theme}`);
    await page.evaluate(() => localStorage.setItem('shark_help_playground_seen', 'true'));
    await page.getByRole('navigation', { name: uiMessage(lang, 'navigation.main') }).getByRole('button', { name: translations[lang].playground, exact: true }).click();
    await expect(page.getByRole('tab', { name: translations[lang].flashcards, exact: true })).toBeVisible();
    await scan(`Flashcard setup ${lang}/${theme}`);
    await page.getByRole('tab', { name: translations[lang].practice, exact: true }).click();
    await scan(`Practice setup ${lang}/${theme}`);
    await page.setViewportSize({ width: 844, height: 390 });
    await page.getByRole('button', { name: translations[lang].askShark, exact: true }).click();
    const minimize = page.getByRole('button', { name: uiMessage(lang, 'aichatbot.minimize_chat'), exact: true });
    await expect(minimize).toBeInViewport();
    const messages = page.getByRole('log', { name: uiMessage(lang, 'aichatbot.messages') });
    await messages.focus();
    await expect(messages).toBeFocused();
    await scan(`Expanded landscape chat ${lang}/${theme}`);
    await minimize.click();
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/forum');
    await expect(page.getByText('Accessible discussion math', { exact: true }).first()).toBeVisible();
    await expect(page.locator('main img').first()).toBeVisible();
    await expect(page.locator('main img:not([alt=""])')).toHaveCount(0);
    await scan(`Forum ${lang}/${theme}`);
    await page.goto(`/forum/a11y-${test.info().project.name}-math`);
    await expect(page.getByText('A public learning discussion.', { exact: true })).toBeVisible();
    await scan(`Forum detail ${lang}/${theme}`);
    await page.goto('/arena');
    await expect(page.getByText(translations[lang].noArenaExams, { exact: true }).or(page.locator('main a[href^="/arena/"]')).first()).toBeVisible();
    await scan(`Arena ${lang}/${theme}`);
    await page.goto('/profile');
    await expect(page.getByRole('heading', { name: accountMessages[lang].title, exact: true })).toBeVisible();
    await scan(`Profile ${lang}/${theme}`);
  }
});
