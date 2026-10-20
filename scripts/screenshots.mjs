// Visual smoke check: signs in and captures key screens.
// Usage: node scripts/screenshots.mjs <outDir> [baseUrl] [--dark] [--ar] [--mobile]
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const [outDir = 'screenshots', base = 'http://localhost:5173'] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const dark = process.argv.includes('--dark');
const ar = process.argv.includes('--ar');
const mobile = process.argv.includes('--mobile');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: dark ? 'dark' : 'light',
});
await context.addInitScript(([lang]) => {
  try {
    if (lang) localStorage.setItem('physio360.lang', lang);
  } catch {}
}, [ar ? 'ar' : null]);
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
page.on('console', (m) => m.type() === 'error' && errors.push(`console: ${m.text()}`));

const suffix = `${dark ? '-dark' : ''}${ar ? '-ar' : ''}${mobile ? '-mobile' : ''}`;
const shot = async (name) => {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${outDir}/${name}${suffix}.png`, fullPage: false });
};

await page.goto(`${base}/login`);
await shot('01-login');
await page.getByLabel(/email|البريد/i).fill('sarah@physio360.test');
await page.getByLabel(/^password|^كلمة المرور/i).fill('Physio@2026');
await page.getByRole('button', { name: /sign in|تسجيل الدخول/i }).click();
await page.waitForURL(`${base}/`);

const pages = (process.env.PAGES ?? '/,/appointments,/appointments?view=day,/patients,/patients/1,/patients/1?tab=notes,/patients/1?tab=progress,/enquiries,/treatment-plans/1,/exercises,/billing,/reports,/staff,/settings?section=services').split(',');
let i = 2;
for (const path of pages) {
  await page.goto(`${base}${path}`);
  await shot(`${String(i++).padStart(2, '0')}-${path.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'dashboard'}`);
}

console.log(errors.length ? errors.join('\n') : 'no console errors');
await browser.close();
