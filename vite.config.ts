import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Project Pages URL: https://mariyaarsenova211296-max.github.io/tv-cinema/
export default defineConfig({
  base: '/tv-cinema/',
  plugins: [react()],
  server: { host: '0.0.0.0' },
  preview: { host: '0.0.0.0' },
});
