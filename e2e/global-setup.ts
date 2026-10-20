import { execSync } from 'node:child_process';

/** Fresh, deterministic data for every run (isolated E2E database). */
export default function globalSetup() {
  execSync('php artisan migrate:fresh --seed --force', {
    cwd: '../backend',
    stdio: 'inherit',
    env: { ...process.env, DB_DATABASE: process.env.E2E_DB ?? 'physio360_e2e', APP_ENV: 'local', MAIL_MAILER: 'array', QUEUE_CONNECTION: 'sync' },
  });
}
