import { expect, test } from '@playwright/test';
import { PASSWORD, signInClinic, STAFF, URLS } from './helpers';

test('rejects a wrong password without revealing which field was wrong', async ({ page }) => {
  await page.goto(`${URLS.clinic}/login`);
  await page.getByLabel('Email').fill(STAFF.owner);
  await page.getByRole('textbox', { name: 'Password' }).fill('wrong-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('credentials');
});

test('signs in, shows the dashboard and signs out', async ({ page }) => {
  await signInClinic(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Dr. Sarah');
  await expect(page.getByText("Today's Appointments")).toBeVisible();

  await page.getByRole('button', { name: 'Dr. Sarah Mathew' }).click();
  await page.getByRole('menuitem', { name: 'Sign out' }).click();
  await expect(page).toHaveURL(/\/login/);

  // The session is really gone server-side.
  await page.goto(`${URLS.clinic}/patients`);
  await expect(page).toHaveURL(/\/login\?next=%2Fpatients/);
});

test('front desk does not see clinical or admin modules', async ({ page }) => {
  await signInClinic(page, STAFF.frontDesk);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  await expect(nav.getByRole('link', { name: 'Enquiries' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Treatment Plans' })).toHaveCount(0);
  await expect(nav.getByRole('link', { name: 'Settings' })).toHaveCount(0);

  await page.goto(`${URLS.clinic}/settings`);
  await expect(page.getByText('You do not have permission to do that.')).toBeVisible();
});

test('runs in English only, without a language picker', async ({ page }) => {
  await signInClinic(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('html')).toHaveAttribute('dir', 'ltr');
  await expect(page.getByRole('button', { name: /^Language/ })).toHaveCount(0);
  expect(PASSWORD).toBeTruthy();
});
