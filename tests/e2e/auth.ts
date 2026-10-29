import type { Page } from '@playwright/test';
import { expect } from './fixtures';

export async function signInDemo(page: Page, route = '/login') {
  await page.goto(route);
  const ready = page.waitForEvent('popup');
  await page.getByRole('button', { name: /Google/i }).click();
  const popup = await ready;
  await popup.waitForLoadState('load');
  await popup.getByText('Add new account', { exact: true }).click();
  await popup.getByText('Auto-generate user information', { exact: true }).click();
  await popup.getByRole('button', { name: /sign in with google/i }).click();
  await expect(page).toHaveURL('http://127.0.0.1:9002/');
  await page.getByRole('button', { name: 'GOT IT', exact: true }).click();
  await page.getByRole('button', { name: 'Minimize chat' }).click();
  await expect(page.getByRole('button', { name: 'ACTIVITY CALENDAR', exact: true })).toBeVisible();
}
