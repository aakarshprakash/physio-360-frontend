// Renders the Physio360 mark to the PNG icon sizes the PWA manifest needs.
// Usage: node scripts/make-icons.mjs apps/patient/public/icons
import { chromium } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? 'apps/patient/public/icons';
mkdirSync(out, { recursive: true });

const mark = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="100%" height="100%">
  <defs>
    <linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#A9D8C8"/><stop offset="1" stop-color="#65A995"/></linearGradient>
    <linearGradient id="b" x1="1" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#65A995"/><stop offset="1" stop-color="#2F7D66"/></linearGradient>
  </defs>
  <rect width="48" height="48" fill="#142D36"/>
  <g transform="translate(${pad} ${pad}) scale(${(48 - pad * 2) / 48})">
    <circle cx="19" cy="7.5" r="4.5" fill="#fff"/>
    <path d="M8 15c6 1 11 5 13 12 1.5 5 1 11-2 17-1-7-3-12-7-16-3-3-5-8-4-13Z" fill="url(#b)"/>
    <path d="M42 4c-2 9-7 15-14 19-4 2-6 6-6 11 0 4 1 7 3 10 5-4 9-10 11-17 2-6 4-15 6-23Z" fill="url(#a)"/>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, size, pad, radius] of [
  ['icon-192.png', 192, 6, 0.22],
  ['icon-512.png', 512, 6, 0.22],
  ['icon-maskable-512.png', 512, 12, 0],
  ['apple-touch-icon.png', 180, 6, 0],
]) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;border-radius:${radius * size}px;overflow:hidden">${mark(pad)}</div></body></html>`);
  await page.screenshot({ path: `${out}/${name}`, omitBackground: true });
}
await browser.close();
console.log('icons written to', out);
