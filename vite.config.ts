import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Dual Pages: this branch builds to /tv-cinema/alt/
const base = process.env.VITE_BASE || '/tv-cinema/alt/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
