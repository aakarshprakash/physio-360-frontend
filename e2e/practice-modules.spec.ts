import { expect, test, type Page } from '@playwright/test';
import { PASSWORD, signInClinic, STAFF, URLS } from './helpers';

/** YYYY-MM-DD of a Monday a few weeks ahead (clinic time), clear of seeded leave. */
function mondayInWeeks(weeks: number): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  d.setDate(d.getDate() + ((8 - d.getDay()) % 7 || 7) + (weeks - 1) * 7);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Sign in as someone else in the same browser (sessions are cookies shared across localhost ports). */
async function switchToClinicUser(page: Page, email: string) {
  await page.context().clearCookies();
  await signInClinic(page, email);
}

async function signInConsole(page: Page) {
  await page.context().clearCookies();
  await page.goto(`${URLS.console}/login`);
  await page.getByLabel('Email').fill('admin@sysnac.test');
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Console' })).toBeVisible();
}

test('groups the navigation and switches the whole portal to Malayalam', async ({ page }) => {
  await signInClinic(page);
  const nav = page.getByRole('navigation', { name: 'Main navigation' });
  for (const group of ['Practice', 'Clinical', 'Billing & Finance', 'Communication', 'Team & HR', 'Administration']) {
    await expect(nav.getByRole('button', { name: group })).toBeVisible();
  }

  // Collapsing a section hides its items; the choice survives navigation.
  await nav.getByRole('button', { name: 'Communication' }).click();
  await expect(nav.getByRole('link', { name: 'Messages' })).toBeHidden();
  await nav.getByRole('link', { name: 'Patients' }).click();
  await expect(nav.getByRole('link', { name: 'Messages' })).toBeHidden();
  await nav.getByRole('button', { name: 'Communication' }).click();
  await expect(nav.getByRole('link', { name: 'Messages' })).toBeVisible();
});

test('writes a prescription from a consultation', async ({ page, context }) => {
  context.on('page', (popup) => void popup.close()); // the PDF opens in a new tab
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/consultations`);
  await expect(page.getByRole('heading', { name: 'Consultations' })).toBeVisible();

  await page.getByRole('link', { name: 'Anil Kumar' }).first().click();
  await page.getByRole('tab', { name: 'Prescriptions' }).click();
  await page.getByRole('button', { name: 'New prescription' }).click();

  const dialog = page.getByRole('dialog', { name: 'New prescription' });
  await dialog.getByLabel('Diagnosis').fill('Patellofemoral pain syndrome (R)');
  await dialog.getByRole('button', { name: 'Add treatment' }).click();
  await dialog.getByRole('combobox', { name: 'Modality / technique' }).fill('TENS'); // input with suggestions (datalist)
  await dialog.getByRole('spinbutton', { name: 'Minutes' }).fill('15');
  await dialog.getByLabel('Advice').fill('Avoid deep squats for two weeks.');
  await dialog.getByRole('button', { name: 'Save' }).click();

  await expect(page.getByText(/Prescription RX-KOC-\d{6} issued/)).toBeVisible();
  await expect(page.getByText('Patellofemoral pain syndrome (R)')).toBeVisible();

  await page.goto(`${URLS.clinic}/prescriptions`);
  await expect(page.getByText('Patellofemoral pain syndrome (R)')).toBeVisible();

  await page.goto(`${URLS.clinic}/patients/1?tab=timeline`);
  await expect(page.getByRole('heading', { name: 'Patient timeline' })).toBeVisible();
  await expect(page.getByText(/RX-KOC-\d{6} by Dr\. Sarah Mathew/).first()).toBeVisible();
});

test('clocks a staff member in and out', async ({ page }) => {
  await signInClinic(page, STAFF.accountant);
  await page.goto(`${URLS.clinic}/attendance`);
  await page.getByRole('button', { name: 'Clock in' }).click();
  await expect(page.getByText(/Clocked in at \d{2}:\d{2}/).first()).toBeVisible();
  await page.getByRole('button', { name: 'Clock out' }).click();
  await expect(page.getByText(/Clocked out at \d{2}:\d{2}/).first()).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Monthly register' })).toBeVisible();
});

test('applies for leave and gets it approved', async ({ page }) => {
  const day = mondayInWeeks(6);
  await signInClinic(page, STAFF.frontDesk);
  await page.goto(`${URLS.clinic}/leave`);
  await page.getByRole('button', { name: 'Apply for leave' }).click();
  const dialog = page.getByRole('dialog', { name: 'Apply for leave' });
  await dialog.getByLabel('Leave type').selectOption({ label: 'Casual Leave' });
  await dialog.getByLabel('From').fill(day);
  await dialog.getByLabel('To').fill(day);
  await dialog.getByLabel('Reason').fill('E2E: cousin wedding');
  await dialog.getByRole('button', { name: 'Apply for leave' }).click();
  await expect(page.getByText('Leave request submitted')).toBeVisible();
  await expect(page.getByRole('row', { name: /E2E: cousin wedding/ }).getByText('Pending')).toBeVisible();

  await switchToClinicUser(page, STAFF.owner);
  await page.goto(`${URLS.clinic}/leave`);
  const row = page.getByRole('row', { name: /E2E: cousin wedding/ });
  await row.getByRole('button', { name: /^Approve/ }).click();
  await expect(page.getByText('Leave approved')).toBeVisible();
  await expect(row.getByText('Approved')).toBeVisible();
});

test('sends a payment reminder without a gateway via a prefilled WhatsApp link', async ({ page }) => {
  await signInClinic(page, STAFF.frontDesk);
  await page.goto(`${URLS.clinic}/payment-reminders`);
  await page.getByRole('button', { name: 'Remind', exact: true }).first().click();
  const dialog = page.getByRole('dialog', { name: /Remind selected/ });
  await dialog.getByRole('radio', { name: 'WhatsApp' }).click();
  await dialog.getByRole('button', { name: 'Send' }).click();

  const result = page.getByRole('dialog', { name: 'Ready to send from your phone' });
  await expect(result.getByRole('link', { name: 'Open WhatsApp' }).first()).toHaveAttribute('href', /^https:\/\/wa\.me\/\d+\?text=/);
  await result.getByRole('button', { name: 'Close' }).last().click();

  await page.goto(`${URLS.clinic}/messages`);
  await expect(page.getByRole('cell', { name: 'Send manually' }).first()).toBeVisible();
});

test('runs and finalizes a month of payroll', async ({ page }) => {
  await signInClinic(page, STAFF.accountant);
  await page.goto(`${URLS.clinic}/payroll`);
  await expect(page.getByRole('link', { name: /\d{4}$/ }).first()).toBeVisible(); // seeded run for last month

  const now = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  await page.getByRole('button', { name: 'Run payroll' }).click();
  const dialog = page.getByRole('dialog', { name: 'Run payroll' });
  await dialog.getByLabel('Month').fill(month);
  await dialog.getByRole('button', { name: 'Run payroll' }).click();

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Payroll ·');
  await expect(page.getByRole('row', { name: /Dr\. Sarah Mathew/ })).toBeVisible();
  await page.getByRole('button', { name: 'Finalize payroll' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Finalize payroll' }).click();
  await expect(page.getByText('Payroll finalized')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeVisible();
});

test('raises a support request that SYSNAC answers from the console', async ({ page }) => {
  await signInClinic(page);
  await page.goto(`${URLS.clinic}/support`);
  await page.getByRole('button', { name: 'New support request' }).click();
  const dialog = page.getByRole('dialog', { name: 'New support request' });
  await dialog.getByLabel('Subject').fill('E2E: export patients to Excel');
  await dialog.getByLabel('Category').selectOption('data');
  await dialog.getByLabel('Describe the issue').fill('Where do we export the patient list?');
  await dialog.getByRole('button', { name: 'Submit request' }).click();
  await expect(page.getByText(/Request SUP-\d{5} submitted/)).toBeVisible();

  await signInConsole(page);
  await page.goto(`${URLS.console}/support`);
  await page.getByRole('button', { name: /E2E: export patients to Excel/ }).click();
  await page.getByLabel('Reply', { exact: true }).fill('Reports & Analytics → Export patients.');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByText('Reply sent to the clinic')).toBeVisible();

  await switchToClinicUser(page, STAFF.owner);
  await page.goto(`${URLS.clinic}/support`);
  await page.getByRole('button', { name: /E2E: export patients to Excel/ }).click();
  await expect(page.getByText('Reports & Analytics → Export patients.')).toBeVisible();
  await expect(page.getByText('Awaiting your reply').first()).toBeVisible();
});
