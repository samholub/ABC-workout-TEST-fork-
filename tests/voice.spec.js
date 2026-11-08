// Smoke journey (BACKLOG row 51): spoken cues.
//
// speechSynthesis is replaced with a recorder so the test reads what would be
// said. The clock is faked so the 90-second rest runs instantly.
'use strict';
var pw = require('@playwright/test');
var test = pw.test;
var expect = pw.expect;

test('voice announces the first exercise, the rest, ten seconds and the next set; mute stops it', async function ({ page }) {
  await page.addInitScript(function () {
    window.__said = [];
    function U(t) { this.text = t; }
    window.SpeechSynthesisUtterance = U;
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: {
      speak: function (u) { if (u.text.trim()) window.__said.push(u.text); },
      cancel: function () {}
    } });
  });
  await page.clock.install();
  await page.goto('/index.html');
  var said = function () { return page.evaluate(function () { return window.__said.slice(); }); };

  await expect(page.getByText('Recommended')).toBeVisible();
  await page.getByRole('button', { name: /^Session A/ }).last().click();
  await page.getByRole('button', { name: /Start Lifting/ }).click();
  await expect(page.getByText('0/9 sets', { exact: true })).toBeVisible();
  expect((await said())[0]).toMatch(/^First: Bulgarian Split Squats, 3 sets of 8 to 10 per leg\./);

  var numbers = page.locator('input[type="number"]');
  await numbers.nth(0).fill('35');
  await numbers.nth(1).fill('9');
  await page.getByRole('button', { name: '8', exact: true }).first().click();
  await expect(page.getByText('1/9 sets', { exact: true })).toBeVisible();
  expect(await said()).toContain('Rest 90 seconds');

  await page.clock.fastForward(81000);
  await expect.poll(said).toContain('Ten seconds');
  await page.clock.fastForward(10000);
  await expect.poll(async function () { return (await said()).pop(); })
    .toMatch(/^Bulgarian Split Squats, set 2 of 3(, \d+ pounds)?, 8 to 10 per leg$/);

  await page.getByRole('button', { name: 'Mute voice cues' }).click();
  expect(await page.evaluate(function () { return localStorage.getItem('wk-vc'); })).toBe('false');
  var before = (await said()).length;
  await page.getByRole('button', { name: /Next/ }).first().click();
  await page.getByRole('button', { name: '8', exact: true }).nth(1).click();
  await expect(page.getByText('2/9 sets', { exact: true })).toBeVisible();
  expect((await said()).length).toBe(before);
});
