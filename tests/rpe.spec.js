// Smoke journey (BACKLOG row 39): the RPE chip and the Feel row.
//
// A chip tapped on an unlogged set logs it and starts the rest timer; a
// different chip on that logged set changes only the RPE; Rough on the Game
// Plan stores readiness 1-1-1. Checked through the saved log entry.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('RPE chips log a set once and Rough stores readiness 1-1-1', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await expect(page.getByText('Your Game Plan')).toBeVisible();

  await page.getByRole('button', { name: 'Rough', exact: true }).click();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();

  var skip = page.getByRole('button', { name: 'Skip', exact: true });
  await expect(skip).toHaveCount(0);

  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');

  // Chip on an unlogged set: logged, rest timer running.
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await expect(skip).toBeVisible();

  // Dismiss the timer, then a different chip must not log again or restart it.
  await skip.click();
  await expect(skip).toHaveCount(0);
  await page.getByRole('button', { name: '9', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await expect(skip).toHaveCount(0);

  await page.getByRole('button', { name: /Finish Session/ }).click();
  await page.getByRole('button', { name: 'Save & Done' }).click();
  await expect(page.getByText('Last completed: Session A')).toBeVisible();

  var log = await page.evaluate(function () { return JSON.parse(localStorage.getItem('wk-lg'))[0]; });
  expect(log.readiness).toEqual({ sleep: 1, soreness: 1, motivation: 1 });
  var sets = log.exercises[0].sets;
  expect(sets).toHaveLength(1);
  expect(sets[0].rpe).toBe(9);
  expect(sets[0].weight).toBe(35);
  expect(sets[0].reps).toBe(9);
});
