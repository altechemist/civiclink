import { expect, test } from '@playwright/test';

// Caching, CDN and security headers are set by the hosting configuration (vercel.json), so these
// checks run against the deployed site only: E2E_BASE_URL=https://… npx playwright test -g NFT-1
test.skip(!process.env.E2E_BASE_URL, 'Runs against the deployed site (E2E_BASE_URL)');

test('NFT-11 CDN caching: immutable assets, cached public figures, uncached app shell (NFR-13)', async ({ request }) => {
  const html = await request.get('/');
  expect(html.headers()['cache-control']).toMatch(/max-age=0/);
  const asset = (await html.text()).match(/\/assets\/index-[\w-]+\.js/)![0];
  expect((await request.get(asset)).headers()['cache-control']).toBe('public, max-age=31536000, immutable');
  expect((await request.get('/sw.js')).headers()['cache-control']).toBe('no-cache');

  // The first request may fill the edge cache; the next ones are served from it.
  await request.get('/api/public/stats');
  const timings: number[] = [];
  let hits = 0;
  for (let i = 0; i < 5; i++) {
    const t0 = Date.now();
    const res = await request.get('/api/public/stats');
    timings.push(Date.now() - t0);
    if (/HIT|STALE/.test(res.headers()['x-vercel-cache'] ?? '')) hits++;
  }
  expect(hits).toBeGreaterThanOrEqual(4);
  test.info().annotations.push({ type: 'NFT-11 cached public figures (ms)', description: timings.join(', ') });
});

test('NFT-12 security headers: CSP, HSTS, no framing, no sniffing (NFR-14)', async ({ request, page }) => {
  const h = (await request.get('/')).headers();
  expect(h['content-security-policy']).toContain("default-src 'self'");
  expect(h['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(h['content-security-policy']).not.toContain('unsafe-eval');
  expect(h['strict-transport-security']).toMatch(/max-age=\d{7,}/);
  expect(h['x-content-type-options']).toBe('nosniff');
  expect(h['x-frame-options']).toBe('DENY');

  const violations: string[] = [];
  page.on('console', (m) => /Content Security Policy/.test(m.text()) && violations.push(m.text()));
  for (const path of ['/login', '/transparency']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
  }
  expect(violations).toEqual([]);

  // DEF-14: with the service worker in control, map tiles are fetched by the worker (connect-src) and must still load.
  await page.goto('/');
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await expect.poll(() => page.locator('img.leaflet-tile-loaded').count(), { timeout: 15_000 }).toBeGreaterThan(0);
});
