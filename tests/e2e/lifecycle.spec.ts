import { expect, test } from '@playwright/test';
import { ACCOUNTS, as, PNG, submitReport } from './helpers';

// Locations chosen away from seeded data so duplicate detection does not interfere.
const SPOT_A = { latitude: -28.6802, longitude: 24.6921 };
const SPOT_B = { latitude: -28.6855, longitude: 24.6991 };

test('E2E-01 full lifecycle: resident → official → field worker → resident (SC-01, NFT-05)', async ({ browser }) => {
  const resident = await as(browser, ACCOUNTS.thandi, SPOT_A);
  const official = await as(browser, ACCOUNTS.naledi);
  const worker = await as(browser, ACCOUNTS.sipho);

  // Official keeps the live queue open while the resident submits.
  await official.goto('/official/reports');
  await submitReport(resident, { category: 'Burst Pipe', description: 'E2E: burst pipe flooding the road near the clinic', photo: true, suburb: 'Galeshewe' });
  const ref = (await resident.getByTestId('report-ref').innerText()).trim();
  expect(ref).toMatch(/^CL-\d{4}-\d{4,}$/);

  // NFT-05: the new report appears on the official's queue without a refresh within 5 s.
  const t0 = Date.now();
  await official.getByLabel('Search by reference, suburb or text').fill(ref);
  await expect(official.getByTestId('queue-row').filter({ hasText: ref })).toBeVisible({ timeout: 5_000 });
  test.info().annotations.push({ type: 'NFT-05 submit→queue (ms)', description: String(Date.now() - t0) });

  // Official triages and assigns.
  await official.getByTestId('queue-row').filter({ hasText: ref }).click();
  await official.getByRole('button', { name: 'Review & accept' }).click();
  await official.getByRole('button', { name: 'Accept for review' }).click();
  await expect(official.getByTestId('official-status')).toContainText('Under review');
  await official.getByRole('button', { name: 'Assign field worker' }).click();
  await official.getByLabel('Field worker').selectOption({ label: 'Sipho Dlamini' });
  await official.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(official.getByTestId('official-status')).toContainText('In progress');

  // Resident follows along on the report page.
  await resident.getByRole('link', { name: 'Track this report' }).click();
  await expect(resident.getByTestId('detail-status')).toContainText('In progress');

  // Field worker accepts, starts and completes with proof.
  await worker.goto('/worker');
  await worker.getByTestId('task-card').filter({ hasText: ref }).click();
  await worker.getByRole('button', { name: 'Accept task' }).click();
  await worker.getByRole('button', { name: /start work/ }).click();
  await worker.getByLabel('What did you do?').fill('Pipe joint replaced and pressure tested.');
  await worker.locator('#proof').setInputFiles(PNG);
  const t1 = Date.now();
  await worker.getByRole('button', { name: 'Mark as resolved' }).click();

  // NFT-05: the resident sees Resolved live within 5 s.
  await expect(resident.getByTestId('detail-status')).toContainText('Resolved', { timeout: 5_000 });
  test.info().annotations.push({ type: 'NFT-05 complete→resident (ms)', description: String(Date.now() - t1) });
  await expect(resident.getByText('Pipe joint replaced and pressure tested.').first()).toBeVisible();
  await expect(resident.getByLabel('Proof of repair')).toBeVisible();

  // Resident confirms the fix → Closed.
  await resident.getByRole('button', { name: "Yes, it's fixed" }).click();
  await expect(resident.getByTestId('detail-status')).toContainText('Closed');
});

test('E2E-02 a second resident reporting the same issue is linked as a duplicate (FR-05)', async ({ browser }) => {
  const first = await as(browser, ACCOUNTS.thandi, SPOT_B);
  await submitReport(first, { category: 'Road Damage', description: 'E2E: deep pothole at the taxi stop', suburb: 'Galeshewe' });
  const ref = (await first.getByTestId('report-ref').innerText()).trim();

  const second = await as(browser, ACCOUNTS.pieter, { latitude: SPOT_B.latitude + 0.0003, longitude: SPOT_B.longitude });
  await submitReport(second, { category: 'Road Damage', description: 'E2E: pothole damaging cars at the taxi rank', suburb: 'Galeshewe' });
  await expect(second.getByText('This issue has already been reported')).toBeVisible();
  await expect(second.getByTestId('parent-ref')).toHaveText(ref);
});

test('E2E-03 suburb-targeted alert reaches Galeshewe but not Roodepan (FR-16, FR-17, BR-14)', async ({ browser }) => {
  const official = await as(browser, ACCOUNTS.naledi);
  const title = `E2E water outage ${Date.now()}`;
  await official.goto('/official/alerts/new');
  await official.getByLabel('Type').selectOption('WATER');
  await official.getByLabel('Title').fill(title);
  await official.getByLabel('Message').fill('Water supply interrupted until 18:00 for pipe repairs.');
  await official.getByRole('button', { name: 'Galeshewe' }).click();
  await official.getByRole('button', { name: 'Broadcast now' }).click();
  await expect(official.getByText(/Alert sent to \d+ resident/)).toBeVisible();

  const galeshewe = await as(browser, ACCOUNTS.thandi);
  await galeshewe.goto('/resident/alerts');
  await expect(galeshewe.getByTestId('alert-card').filter({ hasText: title })).toBeVisible();

  const roodepan = await as(browser, ACCOUNTS.pieter);
  await roodepan.goto('/resident/alerts');
  await expect(roodepan.getByRole('heading', { name: 'Alerts' })).toBeVisible();
  await expect(roodepan.getByTestId('alert-card').filter({ hasText: title })).toHaveCount(0);
});

test('E2E-04 each role is denied other roles’ areas (NFR-01)', async ({ browser, page }) => {
  await page.goto('/official/reports');
  await expect(page).toHaveURL(/\/login/);

  const resident = await as(browser, ACCOUNTS.thandi);
  for (const path of ['/official', '/worker', '/admin/users']) {
    await resident.goto(path);
    await expect(resident.getByTestId('forbidden')).toBeVisible();
  }
  const worker = await as(browser, ACCOUNTS.sipho);
  for (const path of ['/official/reports', '/resident', '/map']) {
    await worker.goto(path);
    await expect(worker.getByTestId('forbidden')).toBeVisible();
  }
  const official = await as(browser, ACCOUNTS.naledi);
  await official.goto('/admin/users');
  await expect(official.getByTestId('forbidden')).toBeVisible();
});

test('E2E-05 invalid report input is rejected with field messages (BR-02, NFR-03)', async ({ browser }) => {
  const resident = await as(browser, ACCOUNTS.thandi);
  await resident.goto('/resident/report/new');
  await resident.getByRole('radio', { name: 'Electricity Outage' }).click();
  await resident.getByLabel('What is happening?').fill('dark');
  await resident.getByRole('button', { name: 'Review' }).click();
  await expect(resident.getByText('At least 10 characters')).toBeVisible();
  await expect(resident.getByText('Set the incident location on the map')).toBeVisible();
  await expect(resident.getByText('Choose how serious it is')).toBeVisible();
  await expect(resident.getByRole('button', { name: 'Submit report' })).toHaveCount(0);
});

test('E2E-06 wrong password shows a generic error (FR-02)', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill(ACCOUNTS.thandi);
  await page.getByLabel('Password').fill('not-the-password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
});
