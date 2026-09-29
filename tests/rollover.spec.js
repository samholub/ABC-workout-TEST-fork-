// Smoke journey (BACKLOG row 40): the day rolls over with the app open.
//
// Rows 15 and 34 were both day-rollover defects. Finish a session late in the
// evening, let the clock pass local midnight without reloading, and the
// header must fall back from "1 session today" to "Ready to train" while the
// recommendation stays on the next session.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('the header resets at local midnight and Next Up stays put', async function ({ page }) {
  await page.clock.install({ time: new Date(2026, 8, 28, 23, 30, 0) });
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();

  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await expect(page.getByText('Your Game Plan')).toBeVisible();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();

  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /Finish Session/ }).click();
  await page.getByRole('button', { name: 'Save & Done' }).click();

  await expect(page.getByText('1 session today')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recommended/ }))
    .toContainText('Session B');

  // Pass local midnight with the app still open; the rollover check runs on
  // its 60s interval.
  await page.clock.fastForward('01:00:00');

  await expect(page.getByText('Ready to train')).toBeVisible();
  await expect(page.getByText('1 session today')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Recommended/ }))
    .toContainText('Session B');
});
