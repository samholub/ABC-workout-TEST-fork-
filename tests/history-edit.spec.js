// Smoke journey (BACKLOG row 88): History edits can never land on another session.
//
// Logging a past session re-sorts the list. Before the fix, an open "Edit sets"
// panel then pointed at whichever session moved into its position, and "Save
// changes" overwrote that session's sets. Now adding a session closes the edit.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('adding a past session while editing another leaves every session intact', async function ({ page }) {
  await page.addInitScript(function () {
    if (localStorage.getItem('wk-lg')) return;
    function at(day, s, w) {
      return { date: new Date(day + 'T12:00:00').toISOString(), session: s, duration: 20,
        exercises: [{ id: s === 'A' ? 'bss-a' : 'sldl-b', sets: [{ weight: w, reps: 8, rpe: 7, completed: true }] }] };
    }
    localStorage.setItem('wk-lg', JSON.stringify([at('2026-11-07', 'A', 50), at('2026-11-04', 'B', 40), at('2026-11-02', 'A', 30)]));
  });
  await page.goto('/index.html');
  await page.getByRole('button', { name: /History/ }).click();
  await page.locator('text=Session A').nth(1).click();
  await page.getByRole('button', { name: 'Edit sets' }).click();
  await page.getByRole('button', { name: 'Log past session' }).click();
  await page.locator('input[type=date]').fill('2026-11-06');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);

  var lg = await page.evaluate(function () { return JSON.parse(localStorage.getItem('wk-lg')); });
  var weightOf = function (day) {
    var l = lg.find(function (x) { return x.date.slice(0, 10) === day; });
    return l.exercises.length ? l.exercises[0].sets[0].weight : null;
  };
  expect(lg.length).toBe(4);
  expect(weightOf('2026-11-07')).toBe(50);
  expect(weightOf('2026-11-04')).toBe(40);
  expect(weightOf('2026-11-02')).toBe(30);
});
