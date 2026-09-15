// Smoke test: the one journey that must never break.
//
// Start a session, log a set, back out with the X, and get the set back.
// This is the app's only defence against silently eating a workout: the
// draft in localStorage. BACKLOG row 1 is the fix that makes it pass.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

// The draft is written to localStorage on a 5s interval while the workout
// screen is mounted (see the useEffect in section 9). Anything typed has to
// survive one tick before it is durable.
var DRAFT_TICK_MS = 5000;

test('a session survives backing out and resuming', async function ({ page }) {
  var consoleErrors = [];
  page.on('console', function (msg) {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', function (err) {
    consoleErrors.push('pageerror: ' + err.message);
  });

  // --- load ------------------------------------------------------------
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();
  expect(consoleErrors, 'console errors on load').toEqual([]);

  // --- Session A -------------------------------------------------------
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await expect(page.getByText('Quick Check-In')).toBeVisible();

  // --- readiness: three taps, one per row -------------------------------
  await page.getByText('Great', { exact: true }).click();     // Sleep Quality
  await page.getByText('None', { exact: true }).click();      // Body Soreness
  await page.getByText('Fired Up', { exact: true }).click();  // Motivation

  // --- Start Lifting ----------------------------------------------------
  // Readiness hands off to the Game Plan screen, which is where the
  // Start Lifting button actually lives.
  await page.getByRole('button', { name: /See Game Plan/ }).click();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();

  // --- fill and complete one set ---------------------------------------
  // The first exercise (Bulgarian Split Squats) is expanded on arrival.
  var numbers = page.locator('input[type="number"]');
  var weight = numbers.nth(0);
  var reps = numbers.nth(1);
  await weight.fill('35');
  await reps.fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click(); // RPE 8

  // Tap the set-1 check circle. It reads "1" until completed, then a check.
  var setCheck = page.locator('div').filter({ hasText: /^1$/ }).last();
  await setCheck.click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();

  // Let the draft autosave tick pick the set up.
  await page.waitForTimeout(DRAFT_TICK_MS + 1000);

  // --- back out with the X ----------------------------------------------
  await page.getByRole('button', { name: '✕' }).first().click();

  // --- home shows the banner --------------------------------------------
  await expect(
    page.getByText('Unfinished session found'),
    'the X button must leave the draft intact so the banner appears'
  ).toBeVisible({ timeout: 5000 });

  // --- resume ------------------------------------------------------------
  await page.getByRole('button', { name: 'Resume' }).click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();

  var resumedWeight = page.locator('input[type="number"]').nth(0);
  await expect(resumedWeight, 'the logged set survives the round trip')
    .toHaveValue('35');
  var resumedReps = page.locator('input[type="number"]').nth(1);
  await expect(resumedReps).toHaveValue('9');

  expect(consoleErrors, 'console errors during the journey').toEqual([]);
});
