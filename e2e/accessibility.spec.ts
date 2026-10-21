import { test } from '@playwright/test';
import { expectAccessible, PASSWORD, signInClinic, signInPatient, URLS } from './helpers';

test.describe('WCAG 2.1 AA (axe): no serious or critical violations', () => {
  test('clinic sign-in', async ({ page }) => {
    await page.goto(`${URLS.clinic}/login`);
    await expectAccessible(page, 'clinic login');
  });

  test('clinic portal pages', async ({ page }) => {
    await signInClinic(page);
    for (const path of ['/', '/appointments', '/appointments?view=day', '/patients', '/patients/1', '/patients/1?tab=notes', '/enquiries', '/treatment-plans/1', '/exercises', '/billing', '/reports', '/staff', '/settings']) {
      await page.goto(`${URLS.clinic}${path}`);
      await expectAccessible(page, path);
    }
  });

  test('practice modules', async ({ page }) => {
    await signInClinic(page);
    for (const path of [
      '/consultations', '/prescriptions', '/patients/1?tab=timeline', '/patients/1?tab=prescriptions', '/packages',
      '/payment-reminders', '/messages', '/messages?tab=templates', '/attendance', '/leave', '/payroll', '/payroll/1',
      '/payroll?tab=salaries', '/support?ticket=1', '/settings?section=messaging', '/settings?section=hr',
    ]) {
      await page.goto(`${URLS.clinic}${path}`);
      await expectAccessible(page, path);
    }
  });

  test('team, online booking and invoice settings', async ({ page }) => {
    await signInClinic(page);
    for (const path of [
      '/staff', '/staff?tab=roles', '/staff/2', '/staff/2?tab=attendance', '/staff/2?tab=access',
      '/online-bookings', '/settings?section=booking', '/settings?section=invoice', '/settings?section=branches',
    ]) {
      await page.goto(`${URLS.clinic}${path}`);
      await expectAccessible(page, path);
    }
  });

  test('clinic portal in dark mode', async ({ page }) => {
    // A stale stored language from before English-only is ignored.
    await page.addInitScript(() => {
      localStorage.setItem('physio360.lang', 'ar');
      localStorage.setItem('physio360.theme', 'dark');
    });
    await signInClinic(page);
    for (const path of ['/', '/patients/1', '/billing', '/staff/2']) {
      await page.goto(`${URLS.clinic}${path}`);
      await expectAccessible(page, `${path} (dark)`);
    }
  });

  test('public booking page', async ({ page }) => {
    for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
      await page.setViewportSize(viewport);
      await page.goto(`${URLS.patient}/book/demo`);
      await expectAccessible(page, `public booking ${viewport.width}px`);
    }
  });

  test('patient app', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${URLS.patient}/login?clinic=demo`);
    await expectAccessible(page, 'patient login');
    await signInPatient(page);
    for (const path of ['/', '/book', '/exercises', '/appointments', '/invoices', '/consents', '/progress', '/more']) {
      await page.goto(`${URLS.patient}${path}`);
      await expectAccessible(page, `patient ${path}`);
    }
  });

  test('SYSNAC console', async ({ page }) => {
    await page.goto(`${URLS.console}/login`);
    await expectAccessible(page, 'console login');
    await page.getByLabel('Email').fill('admin@sysnac.test');
    await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    for (const path of ['/', '/tenants', '/tenants/1', '/support', '/support?ticket=1']) {
      await page.goto(`${URLS.console}${path}`);
      await expectAccessible(page, `console ${path}`);
    }
  });
});
