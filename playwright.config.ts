import { defineConfig, devices } from '@playwright/test';

/*
 * End-to-end tests run the real stack: Laravel (against an isolated, freshly
 * seeded physio360_e2e MySQL database) and the *production builds* of the three
 * SPAs served by `vite preview` (run `pnpm build` first).
 */
const API_PORT = 8010;
const api = `http://127.0.0.1:${API_PORT}`;
const backendEnv = { DB_DATABASE: process.env.E2E_DB ?? 'physio360_e2e', APP_ENV: 'local', MAIL_MAILER: 'array', QUEUE_CONNECTION: 'sync', CACHE_STORE: 'array' };

export const URLS = {
  clinic: 'http://localhost:4173',
  console: 'http://localhost:4174/console',
  patient: 'http://localhost:4175/my',
};

export default defineConfig({
  testDir: './e2e',
  globalSetup: './e2e/global-setup.ts',
  fullyParallel: false,
  workers: 1, // shared seeded database; flows mutate data
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    trace: 'retain-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
    screenshot: 'only-on-failure',
    locale: 'en-IN',
    timezoneId: 'Asia/Kolkata',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: `php artisan serve --host=127.0.0.1 --port=${API_PORT}`,
      cwd: '../backend',
      url: `${api}/up`,
      env: backendEnv,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    ...(['clinic', 'console', 'patient'] as const).map((app, i) => ({
      command: `pnpm --filter @physio/${app} preview`,
      url: `http://localhost:${4173 + i}${app === 'clinic' ? '' : app === 'console' ? '/console/' : '/my/'}`,
      env: { API_ORIGIN: api },
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    })),
  ],
});
