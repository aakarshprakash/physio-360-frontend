import { expect, test } from '@playwright/test';
import { signInClinic, STAFF, URLS } from './helpers';

test('captures an enquiry, logs a call and converts it to a patient', async ({ page }) => {
  await signInClinic(page, STAFF.frontDesk);
  await page.goto(`${URLS.clinic}/enquiries`);
  await page.getByRole('button', { name: 'New enquiry' }).click();

  const form = page.getByRole('dialog', { name: 'New enquiry' });
  await form.getByLabel('Name').fill('Lakshmi Rao');
  await form.getByLabel('Phone').fill('+91 98111 22334');
  await form.getByLabel('Source').selectOption('whatsapp');
  await form.getByLabel('Condition / reason').fill('Neck pain after long drives');
  await form.getByRole('button', { name: 'Save' }).click();

  const drawer = page.getByRole('dialog', { name: 'Lakshmi Rao' });
  await expect(drawer.getByText('Enquiry received via whatsapp.')).toBeVisible();

  await drawer.getByPlaceholder('What happened?').fill('Explained assessment and fees');
  await drawer.getByRole('button', { name: 'Save activity' }).click();
  await expect(drawer.getByText('Contacted').first()).toBeVisible();

  await drawer.getByRole('button', { name: 'Convert to patient' }).click();
  await page.getByRole('dialog', { name: 'Register as patient' }).getByRole('button', { name: 'Convert to patient' }).click();
  await expect(drawer.getByText('Enquiry converted to patient')).toBeVisible();

  await drawer.getByRole('button', { name: 'View patient' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Lakshmi Rao');
});
