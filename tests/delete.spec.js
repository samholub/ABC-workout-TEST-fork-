// Smoke journey (BACKLOG row 43): deleting a session steps Next Up back.
//
// Next Up is derived from the logs, so removing the newest session from
// History must move the recommendation back to that session, with no stored
// state left counting it. Checked again after a cold reload.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('deleting the newest session from History steps Next Up back', async function ({ page }) {
  await page.addInitScript(function () {
    if (localStorage.getItem('wk-lg')) return;
    function at(day, s) { return { date: new Date(day + 'T12:00:00').toISOString(), session: s, duration: 20, exercises: [] }; }
    localStorage.setItem('wk-lg', JSON.stringify([at('2026-11-03', 'B'), at('2026-11-01', 'A')]));
    localStorage.setItem('wk-st', JSON.stringify({ lastSession: 'B', lastDate: '2026-11-03', isDoubleDay: false, completedToday: [] }));
  });
  await page.goto('/index.html');
  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session C');

  await page.getByRole('button', { name: /History/ }).click();
  await page.getByText('Session B', { exact: true }).first().click();
  await page.getByRole('button', { name: 'Delete session' }).click();
  await page.getByRole('button', { name: 'Delete', exact: true }).click();
  await page.getByRole('button', { name: /^←|Back|Home/ }).first().click();

  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session B');
  await page.reload();
  await expect(page.getByRole('button', { name: /Recommended/ })).toContainText('Session B');
  var st = await page.evaluate(function () { return JSON.parse(localStorage.getItem('wk-st')).lastSession; });
  expect(st).toBe('A');
});
