import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true,
    deps: {
      inline: ['primereact', 'primeicons', 'primeflex'],
    },
    env: {
      VITE_API_URL: 'http://localhost:8080/api/v1',
      VITE_API_BASE_URL: 'http://localhost:8080',
      VITE_SENTRY_DSN: '',
    },
  },
});
