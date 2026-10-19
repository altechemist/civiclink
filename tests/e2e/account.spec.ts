import { expect, test } from '@playwright/test';
import { createUser } from '../support/emulator';
import { PASSWORD, signIn } from './helpers';

test('E2E-08 first Google sign-in completes a resident profile (FR-29, BR-16)', async ({ page }) => {
  await page.goto('/login');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue with Google' }).click();
  const popup = await popupPromise;
  // Auth emulator's fake Google account chooser.
  await popup.getByText('Add new account').click();
  const email = `google.${Date.now()}@example.com`;
  await popup.locator('#email-input').fill(email);
  await popup.locator('#display-name-input').fill('Google Tester');
  await popup.getByRole('button', { name: /Sign in with Google/i }).click();

  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByText(`Signed in as ${email}`)).toBeVisible();
  await page.getByRole('button', { name: 'Finish setting up' }).click();
  await expect(page.getByText('Choose a suburb from the list')).toBeVisible();
  await page.getByLabel('Suburb').selectOption('Roodepan');
  await page.getByRole('button', { name: 'Finish setting up' }).click();
  await expect(page).toHaveURL(/\/resident$/);
  await expect(page.getByText('Roodepan').first()).toBeVisible();
});

test('E2E-09 password reset gives the same answer whether or not the account exists (FR-30)', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Forgot password?' }).click();
  await expect(page.getByText(/Enter your email address above/)).toBeVisible();
  for (const email of ['thandi@civiclink.demo', 'nobody@civiclink.demo']) {
    await page.getByLabel('Email').fill(email);
    await page.getByRole('button', { name: 'Forgot password?' }).click();
    await expect(page.getByText(`If an account exists for ${email}, a password reset link has been sent to it.`)).toBeVisible();
  }
});

test('E2E-10 profile change and POPIA self-deletion (FR-31, FR-32)', async ({ page }) => {
  const email = `leaving.${Date.now()}@civiclink.demo`;
  await createUser({ email, name: 'Leaving Resident', role: 'RESIDENT', suburb: 'Galeshewe' });
  await signIn(page, email);
  await page.getByRole('link', { name: 'My profile' }).click();
  await page.getByLabel('Suburb').selectOption('Homestead');
  await page.getByLabel('Mobile number (optional)').fill('123');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Use a South African number')).toBeVisible();
  await page.getByLabel('Mobile number (optional)').fill('0821234567');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Your details were saved.')).toBeVisible();

  const del = page.getByRole('button', { name: 'Delete permanently' });
  await expect(del).toBeDisabled();
  await page.getByLabel('Type "DELETE" to confirm').fill('DELETE');
  await del.click();
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByText(/Your account and personal information were deleted/)).toBeVisible();
  // The account no longer exists.
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Incorrect email or password.')).toBeVisible();
});
