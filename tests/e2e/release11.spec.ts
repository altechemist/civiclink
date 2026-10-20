import { expect, test, type Page } from '@playwright/test';
import { ACCOUNTS, as, submitReport } from './helpers';

// Spots away from seeded data and from lifecycle.spec.ts; against a deployed site each run moves them.
const RUN_JITTER = process.env.E2E_BASE_URL ? Math.random() * 0.02 : 0;
const offset = () => (test.info().project.name === 'firefox' ? 0.005 : 0) + RUN_JITTER;
const spot = (dLat: number) => ({ latitude: -28.7002 - dLat - offset(), longitude: 24.7301 + dLat });

test('E2E-12 a report made offline is saved on the phone and sent automatically on reconnect (FR-27)', async ({ browser }) => {
  const resident = await as(browser, ACCOUNTS.thandi, spot(0));
  await resident.goto('/resident/report/new');
  await resident.getByRole('radio', { name: 'Electricity Outage' }).click();
  await resident.getByRole('button', { name: 'Use my location' }).click();
  await expect(resident.getByTestId('location-coords')).not.toHaveText(/Tap the map/);
  await resident.getByLabel('Suburb', { exact: true }).selectOption('Galeshewe');
  await resident.getByLabel('What is happening?').fill('E2E: streetlight out on the corner, reported offline');
  await resident.locator('label', { hasText: 'Medium' }).first().click();
  await resident.getByRole('button', { name: 'Review' }).click();

  await resident.context().setOffline(true);
  await resident.getByRole('button', { name: 'Save and send later' }).click();
  await expect(resident.getByTestId('report-queued')).toBeVisible();
  await resident.getByRole('link', { name: 'Back to home' }).click();
  await expect(resident.getByTestId('outbox-entry')).toHaveCount(1);

  await resident.context().setOffline(false);
  const sent = resident.getByTestId('outbox-sent');
  await expect(sent).toBeVisible({ timeout: 20_000 });
  const ref = (await sent.getByRole('link').first().innerText()).trim();
  expect(ref).toMatch(/^CL-\d{4}-\d{4,}$/);
  await expect(resident.getByTestId('outbox-card')).toHaveCount(0);
  await resident.goto('/resident/reports');
  await expect(resident.getByText(ref)).toBeVisible();
});

test('E2E-13 an official schedules an alert for later and cancels it (FR-28)', async ({ browser }) => {
  const official = await as(browser, ACCOUNTS.naledi);
  const title = `E2E scheduled maintenance ${Date.now()}`;
  await official.goto('/official/alerts/new');
  await official.getByLabel('Type').selectOption('WATER');
  await official.getByLabel('Title').fill(title);
  await official.getByLabel('Message').fill('Planned maintenance: water off from 09:00 to 12:00.');
  await official.getByRole('button', { name: 'Galeshewe' }).click();
  await official.getByLabel('Schedule for later').check();
  await official.getByRole('button', { name: 'Schedule alert' }).click();
  await expect(official.getByText(/Alert scheduled for/)).toBeVisible();
  const row = official.getByTestId('scheduled-row').filter({ hasText: title });
  await expect(row).toBeVisible();

  // Not visible to residents before its time.
  const resident = await as(browser, ACCOUNTS.thandi);
  await resident.goto('/resident/alerts');
  await expect(resident.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(resident.getByText(title)).toHaveCount(0);

  await row.getByRole('button', { name: 'Cancel' }).click();
  await expect(row).toHaveCount(0);
});

async function triage(official: Page, ref: string) {
  await official.goto('/official/reports');
  await official.getByLabel('Search by reference, suburb or text').fill(ref);
  await official.getByTestId('queue-row').filter({ hasText: ref }).click();
  await official.getByRole('button', { name: 'Review & accept' }).click();
  await official.getByRole('button', { name: 'Accept for review' }).click();
  await expect(official.getByTestId('official-status')).toContainText('Under review');
}

test('E2E-14 an official assigns several reports to one field worker at once (FR-35)', async ({ browser }) => {
  const official = await as(browser, ACCOUNTS.naledi);
  const refs: string[] = [];
  for (const [i, text] of ['E2E: bulk one, water leaking from a meter box', 'E2E: bulk two, burst pipe next to the school gate'].entries()) {
    const resident = await as(browser, ACCOUNTS.pieter, spot(0.01 + i * 0.01));
    await submitReport(resident, { category: 'Burst Pipe', description: text, suburb: 'Roodepan' });
    refs.push((await resident.getByTestId('report-ref').innerText()).trim());
    await resident.context().close();
  }
  for (const ref of refs) await triage(official, ref);

  await official.goto('/official/reports');
  await official.getByLabel('Search by reference, suburb or text').fill('E2E: bulk');
  for (const ref of refs) await official.getByLabel(`Select ${ref}`).check();
  await expect(official.getByTestId('bulk-assign')).toContainText('2 selected');
  await official.getByLabel('Assign selected to').selectOption({ label: 'Sipho Dlamini' });
  await official.getByRole('button', { name: 'Assign selected' }).click();
  await expect(official.getByTestId('bulk-result')).toContainText('Assigned 2 reports to Sipho Dlamini');
  for (const ref of refs) {
    await expect(official.getByTestId('queue-row').filter({ hasText: ref })).toContainText('Sipho Dlamini');
  }
});

test('E2E-15 the public transparency page works without signing in (FR-36)', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('link', { name: 'See how the municipality is responding' }).click();
  await expect(page).toHaveURL(/\/transparency$/);
  await expect(page.getByRole('heading', { name: 'How Sol Plaatje is responding' })).toBeVisible();
  const kpis = page.getByTestId('public-kpis');
  await expect(kpis).toContainText('Open issues');
  await expect(kpis).toContainText('Resident satisfaction');
  await expect(page.getByTestId('public-departments')).toContainText('Water & Sanitation');
  await expect(page.getByTestId('public-categories').locator('li').first()).toBeVisible();
});
