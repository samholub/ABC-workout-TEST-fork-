// Smoke journey (BACKLOG row 38): export a backup, wipe all data, import the
// same file, and check History and Next Up match what they were before.
//
// Export and import are the only restore path for the user's history.
'use strict';
var fs = require('fs');
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('export, wipe, import restores History and Next Up', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();

  // Finish one Session A so there is history to lose.
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Finish Session/ }).click();
  await page.getByRole('button', { name: 'Save & Done' }).click();
  await expect(page.getByText('Last completed: Session A')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session B');
  var before = await page.evaluate(function () {
    return { logs: localStorage.getItem('wk-lg'), state: localStorage.getItem('wk-st') };
  });

  // Export from Settings.
  await page.getByRole('button', { name: '⚙' }).click();
  var download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export Backup/ }).click();
  var file = await (await download).path();
  var backup = fs.readFileSync(file);

  // Wipe all data from Settings, in the danger section.
  await page.getByText('Danger Zone').click();
  await page.getByRole('button', { name: 'Delete All Data' }).click();
  await page.getByRole('button', { name: 'Delete Everything' }).click();
  await expect(page.getByText('First session → starting with A')).toBeVisible();
  await expect(page.getByText('Last completed: Session A')).toHaveCount(0);
  expect(await page.evaluate(function () { return JSON.parse(localStorage.getItem('wk-lg')); }))
    .toEqual([]);

  // Import the same file.
  await page.getByRole('button', { name: '⚙' }).click();
  var chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import Backup/ }).click();
  await (await chooser).setFiles({
    name: 'backup.json', mimeType: 'application/json', buffer: backup
  });
  await page.getByRole('button', { name: 'Replace Data' }).click();
  await page.waitForFunction(function () {
    var v = localStorage.getItem('wk-lg');
    return v && JSON.parse(v).length === 1;
  });
  await page.waitForLoadState('load');
  await expect(page.getByText('Recommended')).toBeVisible();

  // Same Next Up, same Last completed, same stored history.
  await expect(page.getByText('Last completed: Session A')).toBeVisible();
  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session B');
  await page.getByRole('button', { name: /History/ }).click();
  await expect(page.getByText('No sessions yet')).toHaveCount(0);
  await expect(page.getByText('Session A', { exact: true })).toBeVisible();
  var after = await page.evaluate(function () {
    return { logs: localStorage.getItem('wk-lg'), state: localStorage.getItem('wk-st') };
  });
  // validateLogs (clampSet) drops `touched`, a transient prefill-editing flag
  // on each set, so compare the logs without it. Everything else must match.
  function withoutTouched(json) {
    return JSON.parse(json, function (k, v) { return k === 'touched' ? undefined : v; });
  }
  expect(withoutTouched(after.logs)).toEqual(withoutTouched(before.logs));
  expect(JSON.parse(after.state)).toEqual(JSON.parse(before.state));
});
