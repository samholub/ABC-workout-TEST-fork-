// Smoke journey (BACKLOG row 40): the day rolls over with the app open.
//
// After a session is finished the header reads "1 session today". Once local
// midnight passes with the page still open, the header must fall back to
// "Ready to train" while Next Up stays on the following session.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('header falls back after midnight while Next Up stays on B', async function ({ page }) {
  // Local time, 23:50, so a 20 minute jump crosses local midnight.
  await page.clock.install({ time: new Date(2026, 2, 10, 23, 50, 0) });
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

  await expect(page.getByText('Recommended')).toBeVisible();
  await expect(page.getByText('1 session today')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recommended/ }))
    .toContainText('Session B');

  // Past local midnight, app still open: the 60 s rollover check fires.
  await page.clock.fastForward('20:00');
  await expect(page.getByText('Ready to train')).toBeVisible();
  await expect(page.getByText('1 session today')).toHaveCount(0);
  await expect(page.getByRole('button', { name: /Recommended/ }))
    .toContainText('Session B');
});
