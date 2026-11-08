// Smoke journey (BACKLOG rows 51-55): spoken cues and the rest card.
//
// Cues are pre-recorded clips in audio/ played through one <audio> element.
// window.Audio is replaced with a recorder that "plays" each clip instantly,
// so the test reads which clips the app asked for, and checks every one of
// them exists on disk. The clock is faked so the 90-second rest runs instantly.
'use strict';
var fs = require('fs');
var path = require('path');
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;
var AUDIO = path.join(__dirname, '..', 'audio');

test('cues announce the first exercise, the rest, ten seconds and the next set; mute stops them', async function ({ page }) {
  await page.addInitScript(function () {
    window.__played = [];
    Object.defineProperty(navigator, 'audioSession', { configurable: true, value: { type: 'auto' } });
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
  });
  await page.clock.install();
  await page.goto('/index.html');
  var played = function () { return page.evaluate(function () { return window.__played.slice(); }); };

  await expect(page.getByText('Recommended')).toBeVisible();
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();
  await expect.poll(played).toEqual(expect.arrayContaining(['first-bulgarian-split-squats-3-8-10-leg', 'cue-bss-a']));
  // Row 53: the tap that starts lifting switches iOS to media playback.
  expect(await page.evaluate(function () { return navigator.audioSession.type; })).toBe('playback');

  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  await expect.poll(played).toContain('rest-90');
  // Row 52: the rest card names the next set.
  await expect(page.getByText(/^Next: Bulgarian Split Squats · set 2 of 3/)).toBeVisible();

  await page.clock.fastForward(81000);
  await expect.poll(played).toContain('ten-seconds');
  await page.clock.fastForward(10000);
  await expect.poll(played).toEqual(expect.arrayContaining(['set-bulgarian-split-squats-2-of-3', 'reps-8-10-leg']));

  // Every clip the app asked for was recorded.
  var missing = (await played()).filter(function (k) { return !fs.existsSync(path.join(AUDIO, k + '.mp3')); });
  expect(missing).toEqual([]);

  await page.getByRole('button', { name: 'Mute voice cues' }).click();
  expect(await page.evaluate(function () { return localStorage.getItem('wk-vc'); })).toBe('false');
  var before = (await played()).length;
  await page.getByRole('button', { name: /Next/ }).first().click();
  await page.getByRole('button', { name: '8', exact: true }).nth(1).click();
  await expect(page.getByText('2/9 sets', { exact: true })).toBeVisible();
  expect((await played()).length).toBe(before);
});

// Every cue the app can build for any session, carry choice, set and rest
// option points at a clip that exists. Keys come from the app's own helpers.
test('every possible cue key has a recorded clip', async function ({ page }) {
  await page.goto('/index.html');
  await expect(page.getByText('Recommended')).toBeVisible();
  var keys = await page.evaluate(function () {
    var out = ['ten-seconds', 'session-done', 'voice-on'];
    [60, 75, 90, 120].forEach(function (b) { [0, 5, 7, 9].forEach(function (r) { out.push('rest-' + getAdaptiveRest(b, r)); }); });
    Object.keys(SESSIONS).forEach(function (sk) {
      SESSIONS[sk].exercises.forEach(function (ex) {
        var labels = [ex.name];
        if (ex.isCarry) labels.push(ex.name.replace('Suitcase Carry', "Farmer's Carry").replace('Carries', "Farmer's Carry"));
        labels.forEach(function (lb) {
          for (var k = 0; k < ex.sets; k++) out = out.concat(cueSet(lb, k, ex.sets, 35, ex.reps));
          ['first-', 'next-'].forEach(function (l) { out.push(l + slug(lb) + '-' + ex.sets + '-' + slug(ex.reps)); });
        });
        if ((FORM_CUES[ex.id] || []).length) out.push('cue-' + ex.id);
      });
    });
    for (var w = 2.5; w <= 300; w += 2.5) out.push(lbKey(w));
    return out;
  });
  var missing = keys.filter(function (k) { return !fs.existsSync(path.join(AUDIO, k + '.mp3')); });
  expect(missing).toEqual([]);
});
