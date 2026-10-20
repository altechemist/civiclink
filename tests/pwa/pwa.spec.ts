import { expect, test } from '@playwright/test';

test('NFT-10 the production build is installable and opens offline (FR-34)', async ({ page, context }) => {
  await page.goto('/login');
  // Installability: manifest with name, start URL, standalone display and 192/512 px icons.
  const manifest = await (await page.request.get('/manifest.webmanifest')).json();
  expect(manifest).toMatchObject({ short_name: 'CivicLink', start_url: '/', display: 'standalone' });
  expect(manifest.icons.map((i: { sizes: string }) => i.sizes)).toEqual(expect.arrayContaining(['192x192', '512x512']));
  for (const i of manifest.icons) expect((await page.request.get(i.src)).ok()).toBe(true);

  // The service worker activates and controls the page.
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.reload();
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
  await page.waitForLoadState('load');

  // Offline: the app shell still loads and explains the situation.
  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  await expect(page.getByTestId('offline-banner')).toBeVisible();
  // A deep link also opens from the cached shell.
  await page.goto('/resident/reports');
  await expect(page.locator('#root')).not.toBeEmpty();
  await context.setOffline(false);
});
