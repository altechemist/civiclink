import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';

/**
 * FR-34 / DEF-16: after a production build, writes the list of every built file into dist/sw.js (so the
 * service worker saves the whole app at install) and a version hash of the build and the site's security
 * headers (so a new build or CSP change always installs a fresh worker; browsers only compare sw.js bytes).
 */
function precacheServiceWorker(): Plugin {
  let outDir = 'dist';
  return {
    name: 'civiclink-precache-sw',
    apply: 'build',
    configResolved(c) {
      outDir = c.build.outDir;
    },
    writeBundle(_options, bundle) {
      const files = Object.keys(bundle)
        .filter((f) => /\.(js|css|woff2?|svg|png)$/.test(f) && !f.endsWith('.map'))
        .map((f) => `/${f}`)
        .sort();
      const headers = readFileSync(resolve(__dirname, '../../vercel.json'), 'utf8');
      const hash = createHash('sha256').update(files.join('\n')).update(headers).digest('hex').slice(0, 12);
      const swPath = resolve(__dirname, outDir, 'sw.js');
      const sw = readFileSync(swPath, 'utf8')
        .replace('__BUILD_HASH__', hash)
        .replace('self.__PRECACHE__ || []', JSON.stringify(files));
      writeFileSync(swPath, sw);
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precacheServiceWorker()],
  envDir: '.',
  // /api is proxied to the local Node API (scripts/api-server.mjs) when testing the Vercel path (ADR-0006).
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://127.0.0.1:8787' } },
  build: { chunkSizeWarningLimit: 1500 },
});
