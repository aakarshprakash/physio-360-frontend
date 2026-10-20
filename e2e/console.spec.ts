import { expect, test } from '@playwright/test';
import { PASSWORD, URLS } from './helpers';

test('SYSNAC operator provisions a new clinic', async ({ page }) => {
  await page.goto(`${URLS.console}/login`);
  await page.getByLabel('Email').fill('admin@sysnac.test');
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('heading', { name: 'Platform overview' })).toBeVisible();

  await page.getByRole('link', { name: 'Clinics' }).click();
  await page.getByRole('button', { name: 'New clinic' }).click();
  const dialog = page.getByRole('dialog', { name: 'Provision a new clinic' });
  await dialog.getByLabel('Clinic name').fill('Muscat Motion Physio');
  await dialog.getByLabel('Country').selectOption('OM');
  await dialog.getByLabel('Branch code').fill('MCT');
  await dialog.getByLabel('Owner name').fill('Dr. Salim');
  await dialog.getByLabel('Owner email').fill('salim@motion.test');
  await dialog.getByLabel('Owner initial password').fill('Owner@2026x');
  await dialog.getByRole('button', { name: 'Create clinic' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Muscat Motion Physio');
  await expect(page.getByText('OM · OMR · Asia/Muscat')).toBeVisible();
});
