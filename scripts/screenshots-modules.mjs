// Visual smoke check for the clinic portal's grouped navigation and practice
// modules, in English, Malayalam and Arabic (RTL). Runs against `pnpm dev`.
// Usage: node scripts/screenshots-modules.mjs [outDir] [lang,lang]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
const languages = (process.argv[3] ?? 'en,ml,ar').split(',');
const base = 'http://localhost:5173';
mkdirSync(out, { recursive: true });

const pages = [
  ['dashboard', '/'],
  ['consultations', '/consultations'],
  ['prescriptions', '/prescriptions'],
  ['timeline', '/patients/1?tab=timeline'],
  ['patient-rx', '/patients/1?tab=prescriptions'],
  ['packages', '/packages'],
  ['reminders', '/payment-reminders'],
  ['messages', '/messages'],
  ['templates', '/messages?tab=templates'],
  ['attendance', '/attendance'],
  ['leave', '/leave'],
  ['payroll', '/payroll'],
  ['payroll-run', '/payroll/1'],
  ['salaries', '/payroll?tab=salaries'],
  ['support', '/support?ticket=1'],
  ['settings-messaging', '/settings?section=messaging'],
  ['settings-hr', '/settings?section=hr'],
  ['billing-payments', '/billing?tab=payments'],
];

const browser = await chromium.launch();
const errors = [];

for (const lang of languages) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-IN', timezoneId: 'Asia/Kolkata' });
  await context.addInitScript((l) => localStorage.setItem('physio360.lang', l), lang);
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${lang} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(`${lang} console: ${m.text()}`));

  await page.goto(`${base}/login`);
  await page.locator('input[type=email]').fill('sarah@physio360.test');
  await page.locator('input[type=password]').fill('Physio@2026');
  await page.locator('button[type=submit]').click();
  await page.waitForURL((u) => u.pathname === '/');

  for (const [name, path] of pages) {
    await page.goto(`${base}${path}`);
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(600);
    await page.screenshot({ path: `${out}/${lang}-${name}.png` });
  }
  await context.close();
}

await browser.close();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exitCode = 1;
}
console.log(`screenshots written to ${out}`);
