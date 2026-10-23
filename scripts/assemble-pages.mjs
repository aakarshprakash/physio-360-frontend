// Assembles the three SPAs into one ./dist for static hosting on Cloudflare Pages:
//   /          clinic portal      (apps/clinic/dist)
//   /console/  SYSNAC console     (apps/console/dist)
//   /my/       patient PWA        (apps/patient/dist)
// /api and /sanctum are proxied to the Laravel API by functions/ (same origin = cookie sessions work).
// Pages config: build command `npm run build`, output directory `dist`.
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = join(root, 'dist');

const parts = [
  ['apps/clinic/dist', ''],
  ['apps/console/dist', 'console'],
  ['apps/patient/dist', 'my'],
];

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

for (const [from, to] of parts) {
  const src = join(root, from);
  if (!existsSync(src)) throw new Error(`Missing ${from}: run the app builds first`);
  cpSync(src, join(out, to), { recursive: true });
}
for (const file of ['_redirects', '_headers']) cpSync(join(root, 'pages', file), join(out, file));

console.log('Assembled dist/ (clinic /, console /console/, patient /my/)');
