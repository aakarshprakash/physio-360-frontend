import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const backend = process.env.API_ORIGIN ?? 'http://127.0.0.1:8000';
const proxy = {
  '/api': { target: backend, changeOrigin: false },
  '/sanctum': { target: backend, changeOrigin: false },
};

export default defineConfig({
  base: '/my/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/my/',
        name: 'Physio360 — My Physio',
        short_name: 'My Physio',
        description: 'Book appointments, follow your exercise program and pay invoices.',
        start_url: '/my/',
        scope: '/my/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#F7FAF8',
        theme_color: '#142D36',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Only the app shell is cached. Patient data (/api) is never cached by the service worker.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        navigateFallback: '/my/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/sanctum\//],
        runtimeCaching: [],
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5175, strictPort: true, proxy },
  preview: { port: 4175, strictPort: true, proxy },
  build: {
    target: 'es2022',
    sourcemap: true,
    chunkSizeWarningLimit: 600,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom', 'react-router'], query: ['@tanstack/react-query'], i18n: ['i18next', 'react-i18next'] } } },
  },
});
