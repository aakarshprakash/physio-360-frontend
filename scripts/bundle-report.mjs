// Approximate per-package size of a built chunk using its sourcemap.
import { readFileSync } from 'node:fs';
const map = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const sizes = {};
map.sources.forEach((src, i) => {
  const m = src.match(/node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/);
  const key = m ? m[1] : src.includes('packages/') ? 'packages/' + src.split('packages/')[1].split('/')[0] : 'app';
  sizes[key] = (sizes[key] ?? 0) + (map.sourcesContent?.[i]?.length ?? 0);
});
Object.entries(sizes).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([k, v]) => console.log(String(Math.round(v / 1024)).padStart(6), 'KB', k));
