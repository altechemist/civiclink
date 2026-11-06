import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

/** NFT-07 (NFR-07): resident and worker screens at 360×640 have no horizontal scrolling; panels stay on screen. */
test('NFT-07 mobile layouts fit a 360 px screen', async ({ page }) => {
  const noHorizontalScroll = async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  };
  await signIn(page, ACCOUNTS.thandi);
  for (const path of ['/resident', '/resident/reports', '/resident/alerts', '/resident/report/new']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    await page.waitForTimeout(500); // let lists and maps lay out
    await noHorizontalScroll();
  }
  // DEF-17: the notifications panel stays inside the screen; the map page lists incidents under the map.
  await page.goto('/resident');
  await page.getByTestId('notification-bell').click();
  const box = (await page.getByTestId('notification-panel').boundingBox())!;
  const width = page.viewportSize()!.width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(width);
  await page.keyboard.press('Escape');
  await page.goto('/map');
  await expect(page.getByTestId('incident-item').first()).toBeVisible();
  await noHorizontalScroll();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, ACCOUNTS.sipho);
  await page.goto('/worker');
  await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
  await noHorizontalScroll();
});
