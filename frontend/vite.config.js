/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({ include: /\.(jsx|js|tsx|ts)$/ })],
  server: {
    port: 3000,
  },
  build: {
    outDir: '../dist',
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test-setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.{js,jsx,ts,tsx}'],
      exclude: [
        'node_modules/',
        'src/test-setup.js',
        'src/**/*.test.*',
        'src/**/*.spec.*',
        'src/**/*.config.*',
      ],
    },
  },
});