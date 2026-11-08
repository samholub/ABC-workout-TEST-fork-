// Smoke journey (BACKLOG row 86): a first session starts from sensible loads.
//
// With no history, weighted lifts show and prefill a starting weight instead
// of 0, and changing set 1's weight carries to the sets not yet touched.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('first session prefills starting weights and a weight change carries forward', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await expect(page.getByText(/^Starting point/).first()).toBeVisible();

  await page.getByRole('button', { name: /Start lifting/i }).click();
  var numbers = page.locator('input[type="number"]');
  await expect(numbers.nth(0)).toHaveValue('15');

  await numbers.nth(0).fill('20');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.locator('input[type="number"]').nth(0)).toHaveValue('20');
});
