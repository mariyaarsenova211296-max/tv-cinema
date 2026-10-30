import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'node:path';

// Dual Pages: this branch builds to /tv-cinema/alt/
const base = process.env.VITE_BASE || '/tv-cinema/alt/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
  build: {
    rollupOptions: {
      input: {
        // Outer fixed 1440×860 shell (letterbox). Inner landing entry is separate
        // so the iframe never recursively embeds itself.
        main: resolve(__dirname, 'index.html'),
        inner: resolve(__dirname, 'inner.html'),
      },
    },
  },
});
