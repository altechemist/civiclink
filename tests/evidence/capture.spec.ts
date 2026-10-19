/**
 * Regenerates the UI evidence screenshots for report §5.5 into docs/evidence/.
 *   npm run evidence   (against a running `npm run dev`)
 * Resident/worker screens use a 430×932 phone viewport, staff screens 1440×900 (as in Phase 3).
 */
import { expect, test, type Browser, type Page } from '@playwright/test';
import { ACCOUNTS, signIn } from '../e2e/helpers';

const BEFORE = 'tests/evidence/fixtures/before.jpg';
const AFTER = 'tests/evidence/fixtures/after.jpg';

const OUT = 'docs/evidence';
const PHONE = { width: 430, height: 932 };
const DESKTOP = { width: 1440, height: 900 };
const shot = (page: Page, name: string) => page.screenshot({ path: `${OUT}/${name}.png`, fullPage: false });

async function open(browser: Browser, email: string | null, viewport: { width: number; height: number }, geolocation?: { latitude: number; longitude: number }) {
  const context = await browser.newContext({ viewport, geolocation, permissions: geolocation ? ['geolocation'] : [], deviceScaleFactor: 1 });
  const page = await context.newPage();
  if (email) await signIn(page, email);
  return page;
}

test.describe.configure({ mode: 'serial' });
test.setTimeout(180_000);

test('capture resident screens', async ({ browser }) => {
  const anon = await open(browser, null, PHONE);
  await anon.goto('/login');
  await shot(anon, '01-login');
  await anon.goto('/register');
  await anon.getByRole('button', { name: 'Create account' }).click();
  await shot(anon, '02-register-validation');

  const spot = { latitude: -28.6905, longitude: 24.7102 };
  const r = await open(browser, ACCOUNTS.thandi, PHONE, spot);
  await r.waitForTimeout(800);
  await shot(r, '03-resident-home');
  await r.goto('/resident/report/new');
  await shot(r, '04-report-step1-category');
  await r.getByRole('radio', { name: 'Burst Pipe' }).click();
  await r.getByLabel('What is happening?').fill('leak');
  await r.getByRole('button', { name: 'Review' }).click();
  await r.getByText('At least 10 characters').scrollIntoViewIfNeeded();
  await shot(r, '05-report-validation-errors');
  await r.getByRole('button', { name: 'Use my location' }).click();
  await r.getByLabel('What is happening?').fill('Burst pipe flooding the road outside the clinic since 06:00.');
  await r.locator('label', { hasText: 'High' }).first().click();
  await r.locator('#photos').setInputFiles(BEFORE);
  await r.waitForTimeout(1500);
  await r.getByText('Burst Pipe', { exact: true }).scrollIntoViewIfNeeded();
  await shot(r, '06-report-step2-details');
  await r.getByRole('button', { name: 'Review' }).click();
  await shot(r, '07-report-step3-review');
  await r.getByRole('button', { name: 'Submit report' }).click();
  await expect(r.getByTestId('report-result')).toBeVisible();
  await shot(r, '08-report-submitted');

  const p = await open(browser, ACCOUNTS.pieter, PHONE, { latitude: spot.latitude + 0.0002, longitude: spot.longitude });
  await p.goto('/resident/report/new');
  await p.getByRole('radio', { name: 'Burst Pipe' }).click();
  await p.getByRole('button', { name: 'Use my location' }).click();
  await p.getByLabel('Suburb', { exact: true }).selectOption('Galeshewe');
  await p.getByLabel('What is happening?').fill('Water pouring out of a broken pipe near the clinic.');
  await p.locator('label', { hasText: 'High' }).first().click();
  await p.getByRole('button', { name: 'Review' }).click();
  await p.getByRole('button', { name: 'Submit report' }).click();
  await expect(p.getByText('This issue has already been reported')).toBeVisible();
  await shot(p, '09-report-duplicate');

  await r.goto('/resident/reports');
  await r.waitForTimeout(800);
  await shot(r, '10-my-reports');
  await r.goto('/resident/alerts');
  await r.waitForTimeout(800);
  await shot(r, '13-resident-alerts');
  await r.goto('/map');
  await r.waitForTimeout(2500);
  await shot(r, '14-community-map');
  await r.goto('/official');
  await shot(r, '15-permission-denied');
});

test('capture staff screens', async ({ browser }) => {
  const o = await open(browser, ACCOUNTS.naledi, DESKTOP);
  await o.waitForTimeout(1000);
  await shot(o, '20-official-dashboard');
  await o.goto('/official/reports');
  await o.waitForTimeout(800);
  await shot(o, '21-report-queue');
  await o.getByLabel('Search by reference, suburb or text').fill('no-such-report');
  await shot(o, '22-queue-empty-state');
  await o.getByLabel('Search by reference, suburb or text').fill('');
  await o.getByLabel('Status').selectOption('SUBMITTED');
  await o.getByTestId('queue-row').first().click();
  await o.getByRole('button', { name: 'Review & accept' }).click();
  await o.getByRole('button', { name: 'Accept for review' }).click();
  await o.getByRole('button', { name: 'Assign field worker' }).click();
  await o.getByLabel('Field worker').selectOption({ label: 'Sipho Dlamini' });
  await o.getByLabel('Instructions (optional)').fill('Isolate the valve on the corner first');
  await o.waitForTimeout(1500);
  await shot(o, '23-triage-assign');
  await o.getByRole('button', { name: 'Assign', exact: true }).click();
  await expect(o.getByText('Field worker assigned')).toBeVisible();
  await o.waitForTimeout(500);
  await shot(o, '24-assigned-history');
  await o.goto('/official/alerts/new');
  await o.getByLabel('Title').fill('x'.repeat(5));
  await o.getByRole('button', { name: 'Broadcast now' }).click();
  await shot(o, '25-alert-validation');
  await o.getByLabel('Title').fill('Water interruption: Galeshewe and Roodepan');
  await o.getByLabel('Type').selectOption('WATER');
  await o.getByLabel('Message').fill('Supply will be interrupted from 09:00 to 15:00 for a pipe replacement on Tyson Road. Tankers will be at the community hall.');
  await o.getByRole('button', { name: 'Galeshewe' }).click();
  await o.getByRole('button', { name: 'Roodepan' }).click();
  await shot(o, '26-alert-composer');
  await o.getByRole('button', { name: 'Broadcast now' }).click();
  await expect(o.getByText(/Alert sent to/)).toBeVisible();
  await shot(o, '27-alert-history');
  await o.goto('/official/analytics');
  await o.waitForTimeout(2500);
  await shot(o, '28-analytics');

  const a = await open(browser, ACCOUNTS.admin, DESKTOP);
  await a.goto('/admin/users');
  await a.waitForTimeout(800);
  await shot(a, '30-admin-users');
  await a.goto('/admin/config');
  await a.waitForTimeout(800);
  await shot(a, '31-admin-config');
  await a.goto('/admin/logs');
  await a.getByRole('button', { name: /Run SLA/ }).click();
  await a.waitForTimeout(1500);
  await shot(a, '32-admin-log');
});

test('capture field worker screens', async ({ browser }) => {
  const w = await open(browser, ACCOUNTS.sipho, PHONE);
  await w.waitForTimeout(800);
  await shot(w, '40-worker-tasks');
  await w.getByTestId('task-card').filter({ hasText: 'Isolate the valve' }).first().click();
  await w.waitForTimeout(1500);
  await shot(w, '41-worker-task-detail');
  await w.getByRole('button', { name: 'Accept task' }).click();
  await w.getByRole('button', { name: /start work/ }).click();
  await w.getByRole('button', { name: 'Mark as resolved' }).click();
  await w.waitForTimeout(800);
  await shot(w, '42-worker-completion-validation');
  await w.getByLabel('What did you do?').fill('Valve isolated, damaged 50 mm section replaced and pressure tested.');
  await w.locator('#proof').setInputFiles(AFTER);
  await w.getByRole('button', { name: 'Mark as resolved' }).click();
  await expect(w.getByText(/Completed/).first()).toBeVisible();
  await w.waitForTimeout(800);
  await shot(w, '43-worker-completed');
});

test('capture resident resolution screens', async ({ browser }) => {
  const r = await open(browser, ACCOUNTS.thandi, PHONE);
  await r.goto('/resident/reports');
  await r.getByRole('tab', { name: /Resolved/ }).click();
  await r.getByTestId('report-card').filter({ hasText: 'Resolved' }).first().click();
  await expect(r.getByText('Is the problem fixed?')).toBeVisible();
  await r.waitForTimeout(1500);
  await r.getByText(/Resolved in/).scrollIntoViewIfNeeded();
  await shot(r, '11-report-resolved-confirm');
  await r.getByText('Progress history').scrollIntoViewIfNeeded();
  await shot(r, '12-report-timeline');
});
