import { expect, test } from '@playwright/test';
import { signInPatient, URLS } from './helpers';

test('patient books a visit through the app', async ({ page }) => {
  await signInPatient(page);
  await expect(page.getByRole('heading', { name: 'Anil!' })).toBeVisible();

  await page.getByRole('link', { name: 'Book' }).click();
  await page.getByRole('button', { name: /Follow-up Session/ }).click();
  await page.getByRole('button', { name: /Dr\. Sarah Mathew/ }).click();

  // Walk forward through the offered days until one has free times.
  const days = page.getByRole('button', { pressed: false }).filter({ hasText: /^[A-Z]{3}\d{1,2}$/i });
  const slot = page.getByRole('button').filter({ hasText: /^\d{1,2}:\d{2} [AP]M$/ }).first();
  for (let i = 0; i < 10 && !(await slot.isVisible().catch(() => false)); i++) {
    await days.nth(i).click();
    await page.waitForLoadState('networkidle');
  }
  await slot.click();
  await page.getByRole('button', { name: 'Confirm booking' }).click();

  await expect(page).toHaveURL(`${URLS.patient}/appointments`);
  await expect(page.getByText('Your visit is booked')).toBeVisible();
});

test('patient ticks off a home exercise', async ({ page }) => {
  await signInPatient(page);
  await page.goto(`${URLS.patient}/exercises`);
  const toggle = page.getByRole('button', { name: 'Mark as done' }).first();
  await toggle.click();
  await expect(page.getByRole('button', { name: 'Done today' }).first()).toHaveAttribute('aria-pressed', 'true');
});

test('wrong clinic code is rejected generically', async ({ page }) => {
  await page.goto(`${URLS.patient}/login?clinic=gulf-physio`);
  await page.getByLabel('Email').fill('anil.kumar@example.com');
  await page.getByRole('textbox', { name: 'Password' }).fill('Physio@2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert')).toContainText('do not match');
});
