// RTL guard: layout must use logical utilities (ms/me/ps/pe/start/end/text-start)
// so Arabic mirrors correctly. Physical left/right utilities fail the build.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const roots = ['apps', 'packages'];
const physical = /(?<![\w-])(?:-?(?:ml|mr|pl|pr|left|right|rounded-l|rounded-r|rounded-tl|rounded-tr|rounded-bl|rounded-br|border-l|border-r|text-left|text-right|float-left|float-right)(?:-[\w./[\]]+)?)(?![\w-])/g;
const failures = [];

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', 'dist', 'coverage'].includes(entry)) continue;
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) walk(path);
    else if (/\.(tsx|ts)$/.test(entry) && !entry.endsWith('.d.ts') && !entry.includes('.test.')) {
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        for (const cls of line.matchAll(/className=\{?["'`]([^"'`]+)["'`]/g)) {
          const hits = cls[1].match(physical);
          if (hits) failures.push(`${path}:${i + 1}  ${hits.join(' ')}`);
        }
      });
    }
  }
}

roots.forEach(walk);
if (failures.length) {
  console.error('Physical (non-RTL-safe) utilities found:\n' + failures.join('\n'));
  process.exit(1);
}
console.log('logical CSS check passed');
