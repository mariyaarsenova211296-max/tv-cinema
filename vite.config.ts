import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project Pages: scrub → /tv-cinema/ · gesture alt → /tv-cinema/alt/
const base = process.env.VITE_BASE || '/tv-cinema/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
