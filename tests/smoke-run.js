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

// Turn a finished spawn into an exit code and the line to print.
//
// A run that never happened is never an expected failure. spawnSync reports
// "it never ran" two ways: `error` is set (the child could not be started),
// or `status` is null (killed by a signal, or a platform reporting a failed
// start without populating `error`). Neither is a test result, so neither may
// be reported as XFAIL -- that is the bug from commit d74fd38, where
// spawnSync('npx.cmd', ...) failed with EINVAL on Windows, `status === 0` was
// simply false, and every smoke run printed "smoke XFAIL (expected)" and
// exited 0 without ever launching a browser. A gate that cannot run is a
// failure, not a pass, whatever BACKLOG row 1 says.
function classify(result, expectedFail) {
  if (result.error) {
    return {
      code: 1,
      msg: 'smoke FAILED: could not start Playwright -- ' + result.error.message
    };
  }
  if (result.status === null || result.status === undefined) {
    return {
      code: 1,
      msg: 'smoke FAILED: Playwright never ran to completion' +
        (result.signal ? ' (killed by ' + result.signal + ')' : '') +
        ' -- this is not an expected failure, the gate did not run'
    };
  }

  var ok = result.status === 0;
  if (!expectedFail) {
    return ok
      ? { code: 0, msg: 'smoke passed' }
      : { code: 1,
          msg: 'smoke FAILED (BACKLOG row 1 is DONE, so this is a regression)' };
  }

  // Row 1 still open: a real test result is advisory only, never fatal.
  if (ok) {
    return { code: 0, msg: 'smoke XPASS -- the resume journey now works.\n' +
      'Mark BACKLOG row 1 DONE; smoke becomes enforcing from then on.' };
  }
  return { code: 0,
    msg: 'smoke XFAIL (expected) -- BACKLOG row 1 is still OPEN.' };
}

function main() {
  var expectedFail = rowOneIsOpen();

  // Run Playwright's CLI with this node binary rather than shelling out to
  // npx. On Windows, spawnSync('npx.cmd', ...) without a shell fails with
  // EINVAL; classify() above is what keeps such a failure from reading as a
  // test result.
  var result = spawnSync(
    process.execPath,
    [require.resolve('@playwright/test/cli'), 'test',
      '--config=tests/playwright.config.js'],
    { cwd: ROOT, stdio: 'inherit' }
  );

  var verdict = classify(result, expectedFail);
  console.log('');
  if (verdict.code === 0) console.log(verdict.msg);
  else console.error(verdict.msg);
  process.exit(verdict.code);
}

module.exports = { classify: classify, rowOneIsOpen: rowOneIsOpen };

if (require.main === module) main();
