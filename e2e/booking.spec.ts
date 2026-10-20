import { expect, test, type Page } from '@playwright/test';
import { nextWeekday, signInClinic, STAFF, URLS } from './helpers';

async function registerPatient(page: Page, first: string, phone: string) {
  await page.goto(`${URLS.clinic}/patients?new=1`);
  const dialog = page.getByRole('dialog', { name: 'New patient' });
  await dialog.getByLabel('First name').fill(first);
  await dialog.getByLabel('Last name').fill('E2E');
  await dialog.getByRole('textbox', { name: 'Phone', exact: true }).fill(phone);
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(`${first} E2E`);
}

test('front desk registers a patient, books a free slot, and double-booking is refused', async ({ page }) => {
  await signInClinic(page, STAFF.frontDesk);
  const date = nextWeekday(3);

  await registerPatient(page, 'Meera', '+91 90000 11111');
  await page.getByRole('button', { name: 'New appointment' }).click();
  let dialog = page.getByRole('dialog', { name: 'New Appointment' });
  await dialog.getByLabel('Physiotherapist').selectOption({ label: 'Dr. Arjun Menon' });
  await dialog.getByLabel('Date').fill(date);

  // Take the first slot the server offers.
  const firstSlot = dialog.getByRole('button', { pressed: false }).filter({ hasText: /\d:\d\d [AP]M/ }).first();
  await expect(firstSlot).toBeVisible();
  const time = (await firstSlot.textContent())!.trim();
  await firstSlot.click();
  await dialog.getByRole('button', { name: 'Book appointment' }).click();
  await expect(page.getByText('Appointment booked')).toBeVisible();

  // A second patient at the same time with the same therapist must be refused (409).
  await registerPatient(page, 'Ravi', '+91 90000 22222');
  await page.getByRole('button', { name: 'New appointment' }).click();
  dialog = page.getByRole('dialog', { name: 'New Appointment' });
  await dialog.getByLabel('Physiotherapist').selectOption({ label: 'Dr. Arjun Menon' });
  await dialog.getByLabel('Date').fill(date);
  await expect(dialog.getByRole('button', { name: time, exact: true })).toHaveCount(0); // no longer offered
  await dialog.getByLabel('Start time').selectOption({ label: `${time} ·` });
  await dialog.getByRole('button', { name: 'Book appointment' }).click();
  await expect(dialog.getByText('That time is not available')).toBeVisible();
  await expect(dialog.getByText(/already has an appointment/)).toBeVisible();
});

test('appointment workflow from the calendar drawer', async ({ page }) => {
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/appointments?view=list&date=${nextWeekday(1)}`);
  const row = page.getByRole('row').filter({ hasText: 'Scheduled' }).first();
  await row.getByRole('button').first().click();

  const drawer = page.getByRole('dialog', { name: 'Appointment details' });
  await drawer.getByRole('button', { name: 'Confirm' }).click();
  await expect(drawer.getByText('Confirmed')).toBeVisible();
  await drawer.getByRole('button', { name: 'Check in' }).click();
  await drawer.getByRole('button', { name: 'Complete' }).click();
  await expect(drawer.getByText('Completed', { exact: true })).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Create invoice' })).toBeVisible();
});
