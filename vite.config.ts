import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages project site → /tv-cinema-v2/
const base = process.env.VITE_BASE || '/tv-cinema-v2/';

export default defineConfig({
  base,
  plugins: [react()],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
