// Visual smoke check for the patient PWA (mobile) and the SYSNAC console.
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'screenshots';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch();
const errors = [];

async function run(name, viewport, steps) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name} pageerror: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !m.text().includes('401') && errors.push(`${name}: ${m.text()}`));
  await steps(page, async (file) => {
    await page.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${out}/${file}.png` });
  });
  await context.close();
}

await run('patient', { width: 390, height: 844 }, async (page, shot) => {
  const base = 'http://localhost:5175/my';
  await page.goto(`${base}/login?clinic=demo`);
  await shot('p01-login');
  await page.getByLabel('Email').fill('anil.kumar@example.com');
  await page.getByLabel('Password').fill('Physio@2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => /\/my\/?$/.test(u.pathname));
  await shot('p02-home');
  for (const [path, file] of [['/exercises', 'p03-exercises'], ['/book', 'p04-book'], ['/appointments', 'p05-appointments'], ['/invoices', 'p06-invoices'], ['/consents', 'p07-consents'], ['/progress', 'p08-progress']]) {
    await page.goto(`${base}${path}`);
    await shot(file);
  }
});

await run('console', { width: 1440, height: 900 }, async (page, shot) => {
  const base = 'http://localhost:5174/console';
  await page.goto(`${base}/login`);
  await page.getByLabel('Email').fill('admin@sysnac.test');
  await page.getByLabel('Password').fill('Physio@2026');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL((u) => /\/console\/?$/.test(u.pathname));
  await shot('c01-overview');
  await page.goto(`${base}/tenants`);
  await shot('c02-tenants');
  await page.goto(`${base}/tenants/1`);
  await shot('c03-tenant');
});

console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
