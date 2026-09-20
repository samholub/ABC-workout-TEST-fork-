// Smoke journey (BACKLOG row 36): finish a session and reload.
//
// saveAndFinish is the only path that writes a completed session. After it
// and a cold reload, the session must be in History, "Last completed" must
// name it, and Next Up must have advanced.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('a finished session survives a reload and advances Next Up', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();
  await expect(page.getByText('First session → starting with A')).toBeVisible();

  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await expect(page.getByText('Your Game Plan')).toBeVisible();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();

  // Log one set: weight, reps, then an RPE chip (which logs the set).
  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();

  // Finish -> debrief -> Save & Done.
  await page.getByRole('button', { name: /Finish Session/ }).click();
  await page.getByRole('button', { name: 'Save & Done' }).click();

  // Cold reload: everything below must come from storage.
  await expect(page.getByText('Recommended')).toBeVisible();
  await page.reload();
  await expect(page.getByText('Recommended')).toBeVisible();

  // "Last completed" names the session and Next Up has advanced to B.
  await expect(page.getByText('Last completed: Session A')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recommended/ }))
    .toContainText('Session B');

  // The session is in History.
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.getByText('No sessions yet')).toHaveCount(0);
  await expect(page.getByText('Session A', { exact: true })).toBeVisible();
  var stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem('wk-lg')).map(function (l) { return l.session; });
  });
  expect(stored).toEqual(['A']);
});
