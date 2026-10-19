import { expect, type Browser, type Page } from '@playwright/test';

export const PASSWORD = 'CivicLink#2026';
export const ACCOUNTS = {
  thandi: 'thandi@civiclink.demo', // resident, Galeshewe
  pieter: 'pieter@civiclink.demo', // resident, Roodepan
  naledi: 'naledi@civiclink.demo', // official, Water & Sanitation
  sipho: 'sipho@civiclink.demo', // field worker, Water & Sanitation
  admin: 'admin@civiclink.demo',
};

/** 1×1 PNG used as photo evidence. */
export const PNG = {
  name: 'evidence.png',
  mimeType: 'image/png',
  buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64'),
};

export async function signIn(page: Page, email: string) {
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).not.toHaveURL(/\/login/);
}

/** A separate signed-in browser context, optionally at a fixed GPS position. */
export async function as(browser: Browser, email: string, geolocation?: { latitude: number; longitude: number }) {
  const context = await browser.newContext(geolocation ? { geolocation, permissions: ['geolocation'] } : {});
  const page = await context.newPage();
  await signIn(page, email);
  return page;
}

/** Walks the 3-step report form; returns the result panel text. */
export async function submitReport(page: Page, opts: { category: string; description: string; severity?: string; photo?: boolean; suburb?: string }) {
  await page.goto('/resident/report/new');
  await page.getByRole('radio', { name: opts.category }).click();
  await page.getByRole('button', { name: 'Use my location' }).click();
  await expect(page.getByTestId('location-coords')).not.toHaveText(/Tap the map/);
  if (opts.suburb) await page.getByLabel('Suburb', { exact: true }).selectOption(opts.suburb);
  await page.getByLabel('What is happening?').fill(opts.description);
  await page.locator('label', { hasText: opts.severity ?? 'High' }).first().click();
  if (opts.photo) await page.locator('#photos').setInputFiles(PNG);
  await page.getByRole('button', { name: 'Review' }).click();
  await page.getByRole('button', { name: 'Submit report' }).click();
  await expect(page.getByTestId('report-result')).toBeVisible();
}
