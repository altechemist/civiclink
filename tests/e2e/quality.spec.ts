import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { session } from '../support/emulator';
import { ACCOUNTS, PASSWORD, signIn } from './helpers';

/**
 * NFT-08 (NFR-08): automated WCAG 2.1 A/AA audit (axe-core) of the key pages. No serious or
 *   critical violations are allowed. Map tiles are third-party content and excluded.
 * NFT-06 (NFR-06): key screens become interactive within 3 s; p95 command latency under 2 s.
 */
async function audit(page: Page, name: string) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).exclude('.leaflet-container').analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  test.info().annotations.push({ type: `NFT-08 ${name}`, description: `${results.passes.length} checks passed, ${results.violations.length} violations (${serious.length} serious/critical)` });
  expect(serious.map((v) => `${name} ${v.id}: ${v.nodes.map((n) => `${n.target.join(" ")} ${n.failureSummary?.split("\n")[1] ?? ""}`).join("; ")}`)).toEqual([]);
}

test('NFT-08 accessibility of public home, transparency, login, report form, my reports and queue', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('public-alerts')).toBeVisible();
  await audit(page, 'public home');
  await page.goto('/transparency');
  await expect(page.getByTestId('public-kpis')).toBeVisible();
  await audit(page, 'transparency');
  await page.goto('/login');
  await audit(page, 'login');
  await signIn(page, ACCOUNTS.thandi);
  await page.goto('/resident/report/new');
  await page.getByRole('radio', { name: 'Burst Pipe' }).click();
  await audit(page, 'report form');
  await page.goto('/resident/reports');
  await expect(page.getByTestId('report-card').first()).toBeVisible();
  await audit(page, 'my reports');
  await page.getByRole('button', { name: 'Sign out' }).click();
  await signIn(page, ACCOUNTS.naledi);
  await page.goto('/official/reports');
  await expect(page.getByTestId('queue-row').first()).toBeVisible();
  await audit(page, 'report queue');
});

test('NFT-06 responsiveness: screens interactive < 3 s, p95 command < 2 s', async ({ page }) => {
  await signIn(page, ACCOUNTS.naledi);
  const timings: Record<string, number> = {};
  for (const [path, ready] of [
    ['/official', page.getByRole('heading', { name: /Good day/ })],
    ['/official/reports', page.getByTestId('queue-row').first()],
    ['/official/alerts', page.getByRole('heading', { name: 'Alerts' })],
  ] as const) {
    const t0 = Date.now();
    await page.goto(path);
    await expect(ready).toBeVisible();
    timings[path] = Date.now() - t0;
  }
  for (const [path, ms] of Object.entries(timings)) {
    test.info().annotations.push({ type: `NFT-06 load ${path} (ms)`, description: String(ms) });
    expect(ms).toBeLessThan(3000);
  }

  // p95 latency of 50 sequential calls to a command through the real callable API (client SDK).
  // The latency half uses the emulator harness, so it only runs locally / in CI.
  if (process.env.E2E_BASE_URL) return;
  const official = await session(ACCOUNTS.naledi, PASSWORD);
  const latencies: number[] = [];
  for (let i = 0; i < 50; i++) {
    const t0 = performance.now();
    await official.call('getAnalytics', { days: 30 });
    latencies.push(performance.now() - t0);
  }
  await official.close();
  latencies.sort((a, b) => a - b);
  const p95 = Math.round(latencies[Math.ceil(0.95 * latencies.length) - 1]!);
  test.info().annotations.push({ type: 'NFT-06 p95 getAnalytics (ms)', description: String(p95) });
  expect(p95).toBeLessThan(2000);
});
