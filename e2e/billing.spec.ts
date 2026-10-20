import { expect, test } from '@playwright/test';
import { signInClinic, URLS } from './helpers';

test('creates, posts and settles an invoice, then downloads the PDF', async ({ page }) => {
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/billing?new=1`);

  const editor = page.getByRole('dialog', { name: 'New invoice' });
  await editor.getByRole('combobox').first().fill('Anil');
  await editor.getByRole('option').filter({ hasText: 'Anil Kumar' }).first().getByRole('button').click();
  await editor.getByLabel('Add service').selectOption({ label: 'Follow-up Session' });
  await expect(editor.getByText('₹800.00').last()).toBeVisible();
  await editor.getByRole('button', { name: 'Save draft' }).click();

  await expect(page).toHaveURL(/\/billing\/invoices\/\d+/);
  await page.getByRole('button', { name: 'Post invoice' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Post invoice' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^INV-KOC-\d{6}$/);

  await page.getByRole('button', { name: 'Record payment' }).click();
  const pay = page.getByRole('dialog', { name: 'Record payment' });
  await pay.getByLabel('Reference / UTR').fill('UTR-E2E-001');
  await pay.getByRole('button', { name: 'Record payment' }).click();
  await expect(page.getByText('Payment recorded')).toBeVisible();
  await expect(page.getByText('Paid', { exact: true }).first()).toBeVisible();

  const [response] = await Promise.all([
    page.waitForResponse((r) => /\/api\/invoices\/\d+\/pdf/.test(r.url())),
    page.getByRole('button', { name: 'Download PDF' }).click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

test('posted invoices cannot be edited', async ({ page }) => {
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/billing?status=posted`);
  await page.getByRole('row').nth(1).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/^INV-/);
  await expect(page.getByRole('button', { name: 'Edit' })).toHaveCount(0);
});
