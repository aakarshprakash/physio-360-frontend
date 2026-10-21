import { expect, test } from '@playwright/test';
import { signInClinic, URLS } from './helpers';

test('owner onboards a team member who must set their own password at first sign-in', async ({ page }) => {
  const email = `e2e-${Date.now()}@physio360.test`;
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/staff`);
  await page.getByRole('button', { name: 'Add team member' }).click();

  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Full name').fill('Dr. Nisha Varma');
  await dialog.getByLabel('Work email').fill(email);
  await dialog.getByLabel('Employee ID').fill(`EMP-${Date.now() % 100000}`);
  await dialog.getByLabel('Qualification').fill('MPT (Sports)');
  await dialog.getByRole('radio', { name: /Generate a temporary password/ }).check();
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(dialog.getByText('Sign-in details').first()).toBeVisible();
  const password = (await dialog.locator('dd.font-mono').textContent())?.trim() ?? '';
  expect(password).toMatch(/^[A-Z][a-z]{5}-\d{4}$/);
  await dialog.getByRole('button', { name: 'Done' }).click();

  // The new profile page opened; sign out and sign in as the new member.
  await expect(page.getByRole('heading', { name: 'Dr. Nisha Varma' })).toBeVisible();
  await page.context().clearCookies();
  await page.goto(`${URLS.clinic}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByRole('heading', { name: 'Set your password' })).toBeVisible();
  await page.getByLabel('Temporary password').fill(password);
  await page.getByLabel('New password').fill('NishaSecure2026');
  await page.getByLabel('Confirm password').fill('NishaSecure2026');
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  // Physiotherapists do not manage the team.
  await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Clinic Members' })).toHaveCount(0);
});

test('a patient books online and the front desk confirms the request', async ({ page }) => {
  const name = `Online Patient ${Date.now() % 10000}`;
  await page.goto(`${URLS.patient}/book/demo?src=whatsapp`);
  await page.getByRole('button', { name: /Follow-up Session/ }).click();
  await page.getByRole('button', { name: /Any available therapist/ }).click();

  // Find the first day with free times.
  for (let i = 0; i < 10; i++) {
    if (await page.locator('section button.tabular').count()) break;
    await page.getByRole('option').nth(i + 1).click();
    await page.waitForLoadState('networkidle');
  }
  await page.locator('section button.tabular').first().click();
  await page.getByLabel('Full name').fill(name);
  await page.getByLabel('Mobile number').fill(`+91 98${String(Date.now()).slice(-8)}`);
  await page.getByRole('button', { name: 'Request appointment' }).click();
  await expect(page.getByRole('heading', { name: 'Request received' })).toBeVisible();

  await signInClinic(page);
  await page.goto(`${URLS.clinic}/online-bookings`);
  const card = page.locator('div.rounded-xl', { hasText: name }).first();
  await expect(card.getByText('WhatsApp', { exact: true })).toBeVisible();
  await card.getByRole('button', { name: 'Confirm' }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
  await expect(page.getByRole('dialog').getByText(/Appointment booked for/)).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Done' }).click();

  await page.getByRole('radio', { name: /Confirmed/ }).click();
  await expect(page.getByText(name).first()).toBeVisible();
});
