import { expect, test } from '@playwright/test';
import { ACCOUNTS, signIn } from './helpers';

/** NFT-07 (NFR-07): resident and worker screens at 360×640 have no horizontal scrolling. */
test('NFT-07 mobile layouts fit a 360 px screen', async ({ page }) => {
  const noHorizontalScroll = async () => {
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  };
  await signIn(page, ACCOUNTS.thandi);
  for (const path of ['/resident', '/resident/reports', '/resident/alerts', '/resident/report/new']) {
    await page.goto(path);
    await page.waitForLoadState('networkidle');
    await noHorizontalScroll();
  }
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, ACCOUNTS.sipho);
  await page.goto('/worker');
  await expect(page.getByRole('heading', { name: 'My tasks' })).toBeVisible();
  await noHorizontalScroll();
});
