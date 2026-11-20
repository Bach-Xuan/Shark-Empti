import { translations } from '../../src/lib/translations';
import { signInDemo } from './auth';
import { expect, test } from './fixtures';

test('a personal quiz retake starts a fresh Guru conversation and keeps it through results', async ({ page }) => {
  const t = translations.en;
  await signInDemo(page);
  await page.getByPlaceholder('e.g. Calculus, Redox reactions...').fill('Addition');
  await page.getByRole('textbox', { name: 'Number of Questions' }).fill('1');
  await page.getByRole('button', { name: /start learning/i }).click();
  const finishQuiz = async () => {
    await page.getByRole('button', { name: '4', exact: true }).click();
    await page.getByRole('button', { name: /finish|results/i }).click();
    await expect(page.getByRole('button', { name: t.retakeSame })).toBeVisible();
  };
  await finishQuiz();
  const openChat = page.getByRole('button', { name: t.askShark, exact: true });
  const log = page.getByRole('log');
  const input = page.getByRole('textbox', { name: t.chatPlaceholder, exact: true });
  const reply = 'Adding two and two gives four.';
  await openChat.click();
  await input.fill('Explain my first attempt');
  await input.press('Enter');
  await expect(log.getByText(reply, { exact: true })).toBeVisible();
  await input.fill('Unsent question about the first attempt');
  await page.getByRole('button', { name: 'Minimize chat' }).click();
  await page.getByRole('button', { name: t.retakeSame }).click();
  await openChat.click();
  await expect(log).toHaveText(t.botIntro);
  await expect(input).toHaveValue('');

  const nextRequest = page.waitForRequest(request => request.method() === 'POST'
    && new URL(request.url()).pathname === '/api/ai/generations'
    && request.postDataJSON().operation === 'ai-coaching-chatbot');
  await input.fill('Explain my second attempt');
  await input.press('Enter');
  expect((await nextRequest).postDataJSON().input).toMatchObject({
    userMessage: 'Explain my second attempt', chatHistory: [], quizQuestions: [], quizSummary: { totalQuestions: 0 },
  });
  await expect(log.getByText(reply, { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Minimize chat' }).click();
  await finishQuiz();
  await openChat.click();
  await expect(log.getByText('Explain my second attempt', { exact: true })).toBeVisible();
  await expect(log.getByText(reply, { exact: true })).toBeVisible();
});
