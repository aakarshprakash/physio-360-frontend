import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';

// Dev/preview proxy the API so the browser sees a single origin (as in production behind nginx).
const backend = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const proxy = {
  '/api': { target: backend, changeOrigin: false },
  '/sanctum': { target: backend, changeOrigin: false },
};

export default defineConfig({
  base: '/console/',
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: { port: 5174, strictPort: true, proxy },
  preview: { port: 4174, strictPort: true, proxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600, // gzip budget is enforced separately (see docs/testing.md)
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router'],
          query: ['@tanstack/react-query'],
        },
      },
    },
  },
});
