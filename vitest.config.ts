import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: false,
    setupFiles: ['./vitest.setup.ts'],
    include: ['packages/**/src/**/*.test.{ts,tsx}', 'apps/**/src/**/*.test.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      include: ['packages/*/src/**', 'apps/clinic/src/lib/**'],
      exclude: ['**/*.d.ts', '**/schema.d.ts', '**/*.test.*'],
      reporter: ['text-summary', 'html'],
    },
  },
});
