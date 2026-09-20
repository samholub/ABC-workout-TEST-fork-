// Import path fixtures (BACKLOG row 35).
//
// validateLogs and applyImport guard the only copy of the user's history.
// validateLogs is a top-level function in section 1 (outside the // 4. to
// // 6. slice the unit harness reads), so it is called through page.evaluate.
// applyImport lives inside the App component, so its sort is exercised
// through the real Settings > Import Backup > Replace Data flow.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

function log(date, session) {
  return {
    date: date,
    session: session,
    exercises: [{ id: 'x', sets: [{ weight: 40, reps: 10, rpe: 8, completed: true }] }]
  };
}

test('validateLogs keeps good entries, drops bad ones, never reorders', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();

  var result = await page.evaluate(function (input) {
    return validateLogs(input);
  }, [
    log('2026-03-03', 'C'),
    null,
    { session: 'A' },                       // no date
    { date: '2026-03-02' },                 // no session
    { date: 5, session: 'A' },              // date not a string
    { date: '2026-03-02', session: 'B', exercises: 'nope' }, // exercises not an array
    log('2026-03-01', 'A'),
    'garbage'
  ]);
  expect(result.map(function (l) { return l.date + l.session; }))
    .toEqual(['2026-03-03C', '2026-03-01A']);

  var notArray = await page.evaluate(function () {
    return [validateLogs(null), validateLogs({}), validateLogs('x')];
  });
  expect(notArray).toEqual([[], [], []]);

  // Order in is order out: the oldest-first input must not be sorted here.
  var kept = await page.evaluate(function (input) {
    return validateLogs(input).map(function (l) { return l.date; });
  }, [log('2026-01-01', 'A'), log('2026-02-01', 'B'), log('2026-01-15', 'C')]);
  expect(kept).toEqual(['2026-01-01', '2026-02-01', '2026-01-15']);
});

test('applyImport leaves logs newest-first for a shuffled file', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();

  var backup = {
    version: 21,
    exportDate: '2026-03-10T00:00:00.000Z',
    state: { lastSession: 'C', lastDate: '2026-03-05', isDoubleDay: false, completedToday: [] },
    logs: [
      log('2026-03-02', 'B'),
      log('2026-03-05', 'C'),
      log('2026-03-01', 'A'),
      log('2026-03-04', 'B'),
      log('2026-03-03', 'A')
    ]
  };

  await page.getByRole('button', { name: '⚙' }).click();
  var chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /Import Backup/ }).click();
  await (await chooser).setFiles({
    name: 'backup.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(backup))
  });
  await page.getByRole('button', { name: 'Replace Data' }).click();

  // applyImport reloads the page after 1.5s.
  await page.waitForFunction(function () {
    var v = localStorage.getItem('wk-lg');
    return v && JSON.parse(v).length === 5;
  });
  var stored = await page.evaluate(function () {
    return JSON.parse(localStorage.getItem('wk-lg')).map(function (l) { return l.date; });
  });
  expect(stored).toEqual(['2026-03-05', '2026-03-04', '2026-03-03', '2026-03-02', '2026-03-01']);
});
