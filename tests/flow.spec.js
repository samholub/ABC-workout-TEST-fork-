// Smoke journeys (BACKLOG rows 89-91): fewer taps, circuit switch rests, backup.
'use strict';
var fs = require('fs');
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

function fakeAudio() {
  window.__played = [];
  window.Audio = function () {
    var el = this, ls = {};
    this.src = '';
    this.addEventListener = function (t, f) { (ls[t] = ls[t] || []).push(f); };
    this.pause = function () {};
    this.play = function () {
      var m = /audio\/([^/]+)\.mp3$/.exec(el.src);
      if (m) window.__played.push(m[1]);
      Promise.resolve().then(function () { (ls.ended || []).forEach(function (f) { f(); }); });
      return Promise.resolve();
    };
  };
}
var played = function (page) { return page.evaluate(function () { return window.__played.slice(); }); };

test('a tap on empty space logs the open set; not while the rest is running', async function ({ page }) {
  await page.addInitScript(fakeAudio);
  await page.clock.install();
  await page.goto('/index.html');
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Start lifting/i }).click();
  await expect(page.getByText('Tap anywhere to log set 1 of 3')).toBeVisible();
  // The open set's own label is plain text, not a control: tapping it logs.
  await page.getByText('Set 1 of 3', { exact: true }).click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  // Rest running: a stray tap does nothing.
  await page.getByText('Set 2 of 3', { exact: true }).last().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  // Rest over: the next tap logs set 2 and starts the next rest.
  await page.clock.fastForward(91000);
  await expect(page.getByText('Tap anywhere to log set 2 of 3')).toBeVisible();
  await page.getByText('Set 2 of 3', { exact: true }).last().click();
  await expect(page.getByText('2/9 sets', { exact: true })).toBeVisible();
});

test('timed sets log themselves after the set time, and Hold stops it', async function ({ page }) {
  await page.addInitScript(function () { localStorage.setItem('wk-lm', JSON.stringify('timed')); localStorage.setItem('wk-ws', JSON.stringify(45)); });
  await page.addInitScript(fakeAudio);
  await page.clock.install();
  await page.goto('/index.html');
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Start lifting/i }).click();
  await expect(page.getByText('Logs itself at 0:00')).toBeVisible();
  await page.clock.fastForward(51000);
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await expect.poll(function () { return played(page); }).toContain('rest-90');
  // Rest ends: the next set starts counting on its own.
  await page.clock.fastForward(91000);
  await expect(page.getByText('Logs itself at 0:00')).toBeVisible();
  await page.getByRole('button', { name: 'Hold', exact: true }).click();
  await page.clock.fastForward(60000);
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
});

test('circuit: a 30s switch inside a round, the full rest after it', async function ({ page }) {
  await page.addInitScript(fakeAudio);
  await page.clock.install();
  await page.goto('/index.html');
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Circuit/ }).click();
  await page.getByRole('button', { name: /Start lifting/i }).click();
  var logOne = async function (n) {
    await page.getByRole('button', { name: '8', exact: true }).first().click();
    await expect(page.getByText(n + '/9 sets', { exact: true })).toBeVisible();
  };
  await logOne(1);
  await expect.poll(function () { return played(page); }).toContain('rest-30');
  await page.clock.fastForward(31000);
  await page.clock.runFor(500);
  await logOne(2);
  await page.clock.fastForward(31000);
  await page.clock.runFor(500);
  await logOne(3);
  await expect.poll(function () { return played(page); }).toContain('rest-90');
});

test('backup round trip: restore replaces the history after a confirm', async function ({ page }, info) {
  await page.addInitScript(function () {
    if (localStorage.getItem('wk-lg')) return;
    localStorage.setItem('wk-lg', JSON.stringify([{ date: new Date('2026-11-01T12:00:00').toISOString(), session: 'A', duration: 15,
      exercises: [{ id: 'bss-a', sets: [{ weight: 30, reps: 10, rpe: 7, completed: true }] }] }]));
  });
  await page.goto('/index.html');
  await page.getByRole('button', { name: 'Settings' }).click();
  await expect(page.getByText('No backup yet')).toBeVisible();
  var dl = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Back up', exact: true }).click();
  var file = info.outputPath('backup.json');
  await (await dl).saveAs(file);
  var saved = JSON.parse(fs.readFileSync(file, 'utf8'));
  expect(saved.logs.length).toBe(1);
  await expect(page.getByText(/^Last backup /)).toBeVisible();

  // A second session, then restore the one-session backup over it.
  await page.evaluate(function () {
    var l = JSON.parse(localStorage.getItem('wk-lg'));
    l.unshift({ date: new Date('2026-11-03T12:00:00').toISOString(), session: 'B', duration: 15, exercises: [] });
    localStorage.setItem('wk-lg', JSON.stringify(l));
  });
  await page.reload();
  await page.getByRole('button', { name: 'Settings' }).click();
  await page.locator('input[type=file]').setInputFiles(file);
  await expect(page.getByText(/has 1 session\. It replaces the 2 sessions/)).toBeVisible();
  await page.getByRole('button', { name: 'Restore', exact: true }).last().click();
  await expect(page.getByText('Recommended')).toBeVisible();
  var lg = await page.evaluate(function () { return JSON.parse(localStorage.getItem('wk-lg')); });
  expect(lg.length).toBe(1);
  expect(lg[0].exercises[0].sets[0].weight).toBe(30);
});
