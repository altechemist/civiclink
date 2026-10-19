import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  envDir: '.',
  // /api is proxied to the local Node API (scripts/api-server.mjs) when testing the Vercel path (ADR-0006).
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { chunkSizeWarningLimit: 1500 },
});
