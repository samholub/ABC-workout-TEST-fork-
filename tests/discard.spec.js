// Smoke journey (BACKLOG row 37): every discard path leaves logs and the
// recommendation untouched.
//
// A discarded session must never count as done. After one real session is
// saved, each discard path is walked and wk-lg (logs) and wk-st (cycle state)
// must be byte-identical to what they were before.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

function snapshot(page) {
  return page.evaluate(function () {
    return { logs: localStorage.getItem('wk-lg'), state: localStorage.getItem('wk-st') };
  });
}

async function logOneSet(page) {
  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
}

async function startSession(page, letter) {
  await page.getByRole('button', { name: new RegExp('^Session ' + letter) }).last().click();
  await expect(page.getByText('Your Game Plan')).toBeVisible();
}

test('every discard path leaves logs and the recommendation untouched', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();

  // Save one real session so logs and cycle state are not empty.
  await startSession(page, 'A');
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await logOneSet(page);
  await page.getByRole('button', { name: /Finish Session/ }).click();
  await page.getByRole('button', { name: 'Save & Done' }).click();
  await expect(page.getByText('Last completed: Session A')).toBeVisible();
  var before = await snapshot(page);
  expect(before.logs).not.toBeNull();
  expect(before.state).not.toBeNull();

  // 1. X, then Discard on the unfinished-session banner.
  await startSession(page, 'B');
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await logOneSet(page);
  await page.getByRole('button', { name: '✕' }).first().click();
  await expect(page.getByText('Unfinished session found')).toBeVisible();
  await page.getByRole('button', { name: 'Discard' }).click();
  await expect(page.getByText('Unfinished session found')).toHaveCount(0);
  expect(await snapshot(page), 'X then banner Discard').toEqual(before);

  // 2. Cancel on the Game Plan.
  await startSession(page, 'B');
  await page.getByRole('button', { name: /Cancel/ }).click();
  await expect(page.getByText('Recommended')).toBeVisible();
  expect(await snapshot(page), 'Cancel on the Game Plan').toEqual(before);

  // 3. Finish with no sets, then confirm Discard.
  await startSession(page, 'B');
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Finish Session/ }).click();
  page.once('dialog', function (d) { d.accept(); });
  await page.getByRole('button', { name: 'Save & Done' }).click();
  await expect(page.getByText('Recommended')).toBeVisible();
  expect(await snapshot(page), 'Finish with no sets, confirm Discard').toEqual(before);

  // Next Up is still B after all three.
  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session B');
});
