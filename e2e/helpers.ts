import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';
import { URLS } from '../playwright.config';

export const PASSWORD = 'Physio@2026';
export const STAFF = {
  owner: 'sarah@physio360.test',
  frontDesk: 'reena@physio360.test',
  accountant: 'joseph@physio360.test',
};

export { URLS };

export async function signInClinic(page: Page, email = STAFF.owner) {
  await page.goto(`${URLS.clinic}/login`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
}

export async function signInPatient(page: Page, email = 'anil.kumar@example.com') {
  await page.goto(`${URLS.patient}/login?clinic=demo`);
  await page.getByLabel('Email').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible();
}

/** Next Monday-Friday date (YYYY-MM-DD) at least `daysAhead` days out, in clinic time. */
export function nextWeekday(daysAhead = 2): string {
  const d = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
  d.setDate(d.getDate() + daysAhead);
  while (d.getDay() === 0 || d.getDay() === 6) d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** WCAG 2.1 AA scan; fails on serious or critical violations. */
export async function expectAccessible(page: Page, label: string) {
  await page.waitForLoadState('networkidle');
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).analyze();
  const blocking = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(
    blocking.map((v) => `${v.id} (${v.impact}): ${v.help} -> ${v.nodes.slice(0, 3).map((n) => n.target.join(' ')).join(' | ')}`),
    `Accessibility violations on ${label}`,
  ).toEqual([]);
}
