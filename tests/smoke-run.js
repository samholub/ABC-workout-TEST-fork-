// Runs the Playwright smoke test, and decides whether a failure is fatal.
//
// The smoke test fails against today's index.html: the X button calls home(),
// home() calls clearDraft(), and the unfinished-session banner never appears.
// That is BACKLOG row 1. While row 1 is still OPEN the failure is EXPECTED
// and this script exits 0 so the rest of the loop can run. Once row 1 is
// marked DONE the test is enforced for real.
'use strict';
var fs = require('fs');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var ROOT = path.join(__dirname, '..');
var BACKLOG = path.join(ROOT, 'BACKLOG.md');

function rowOneIsOpen() {
  if (!fs.existsSync(BACKLOG)) return true;
  var line = fs.readFileSync(BACKLOG, 'utf8')
    .split(/\r?\n/)
    .find(function (l) { return /^\|\s*1\s*\|/.test(l); });
  if (!line) return true;
  return /\bOPEN\b|\bBLOCKED\b/.test(line);
}

var expectedFail = rowOneIsOpen();

// Run Playwright's CLI with this node binary rather than shelling out to npx.
// On Windows, spawnSync('npx.cmd', ...) without a shell fails with EINVAL, and
// a failed spawn is indistinguishable from a failed test run -- which silently
// turned every smoke run into a no-op that reported the expected failure.
var result = spawnSync(
  process.execPath,
  [require.resolve('@playwright/test/cli'), 'test',
    '--config=tests/playwright.config.js'],
  { cwd: ROOT, stdio: 'inherit' }
);
if (result.error) {
  console.error('\nsmoke FAILED: could not start Playwright -- ' +
    result.error.message);
  process.exit(1);
}
var ok = result.status === 0;

console.log('');
if (!expectedFail) {
  if (ok) {
    console.log('smoke passed');
    process.exit(0);
  }
  console.error('smoke FAILED (BACKLOG row 1 is DONE, so this is a regression)');
  process.exit(1);
}

// Row 1 still open: advisory only, never fatal.
if (ok) {
  console.log('smoke XPASS -- the resume journey now works.');
  console.log('Mark BACKLOG row 1 DONE; smoke becomes enforcing from then on.');
} else {
  console.log('smoke XFAIL (expected) -- BACKLOG row 1 is still OPEN.');
}
process.exit(0);
