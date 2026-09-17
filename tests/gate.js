// Gate: cheap, fast checks that must hold before anything else runs.
//
//   1. The app's inline script parses (node --check).
//   2. No smart quotes in the two deployed files -- a curly quote pasted into
//      a JS string literal is a silent runtime break on some keyboards, and
//      one pasted into an identifier is a syntax error.
//   3. No mixed line endings -- half-converted files produce diffs that touch
//      every line and hide the real change.
'use strict';
var fs = require('fs');
var path = require('path');
var execFileSync = require('child_process').execFileSync;
var ex = require('./extract.js');

var FILES = ['index.html', 'sw.js'];
var SMART = /[‘’“”]/g;
var failures = [];

// 1. syntax
try {
  var script = ex.inlineScript(ex.readIndex(), 2);
  var tmp = ex.tmpFile('app-check.js', script);
  execFileSync(process.execPath, ['--check', tmp], { stdio: 'pipe' });
  console.log('  ok   inline script #2 parses');
} catch (err) {
  var detail = err.stderr ? err.stderr.toString().trim() : err.message;
  failures.push('inline script #2 failed node --check:\n' + detail);
}

FILES.forEach(function (f) {
  var abs = path.join(ex.ROOT, f);
  var raw = fs.readFileSync(abs, 'utf8');

  // 2. smart quotes
  var hits = [];
  raw.split(/\r?\n/).forEach(function (line, i) {
    var m = line.match(SMART);
    if (m) hits.push('    ' + f + ':' + (i + 1) + ' contains ' + m.join(' '));
  });
  if (hits.length) {
    failures.push('smart quotes in ' + f + ':\n' + hits.join('\n'));
  } else {
    console.log('  ok   ' + f + ' has no smart quotes');
  }

  // 3. line endings
  var lines = raw.split('\n');
  if (lines[lines.length - 1] === '') lines.pop();
  var crlf = lines.filter(function (l) { return l.slice(-1) === '\r'; }).length;
  if (crlf !== 0 && crlf !== lines.length) {
    failures.push('mixed line endings in ' + f + ': ' + crlf + ' CRLF of ' +
      lines.length + ' lines');
  } else {
    console.log('  ok   ' + f + ' line endings consistent (' +
      (crlf === 0 ? 'LF' : 'CRLF') + ')');
  }
});

// 4. index.html and sw.js each carry their own literal `APP_VERSION` (no
//    build step means they can't share a symbol). They must agree, and any
//    index.html change must bump the number -- otherwise a stale sw.js
//    precache silently survives the deploy (see BACKLOG row 6).
(function () {
  var indexSrc = ex.readIndex();
  var swSrc = fs.readFileSync(path.join(ex.ROOT, 'sw.js'), 'utf8');
  var vIndexM = indexSrc.match(/var APP_VERSION\s*=\s*(\d+)/);
  var vSwM = swSrc.match(/var APP_VERSION\s*=\s*(\d+)/);
  if (!vIndexM) {
    failures.push('index.html has no `var APP_VERSION = N;` declaration');
    return;
  }
  if (!vSwM) {
    failures.push('sw.js has no `var APP_VERSION = N;` declaration');
    return;
  }
  var vIndex = vIndexM[1];
  var vSw = vSwM[1];
  if (vIndex !== vSw) {
    failures.push('version mismatch: index.html APP_VERSION=' + vIndex +
      ' but sw.js APP_VERSION=' + vSw);
  } else {
    console.log('  ok   index.html and sw.js agree on APP_VERSION=' + vIndex);
  }

  var prevIndex = null;
  try {
    prevIndex = execFileSync('git', ['show', 'HEAD:index.html'], {
      cwd: ex.ROOT, stdio: 'pipe'
    }).toString('utf8');
  } catch (err) {
    prevIndex = null; // no prior commit to diff against
  }
  // git hands back LF; the working copy may be CRLF under autocrlf.
  var lf = function (s) { return s.replace(/\r\n/g, '\n'); };
  if (prevIndex !== null && lf(prevIndex) !== lf(indexSrc)) {
    var prevVM = prevIndex.match(/var APP_VERSION\s*=\s*(\d+)/);
    if (prevVM && prevVM[1] === vIndex) {
      failures.push('index.html changed but APP_VERSION was not bumped (still v' + vIndex + ')');
    } else {
      console.log('  ok   index.html changed and APP_VERSION was bumped');
    }
  }
})();

if (failures.length) {
  console.error('\ngate FAILED\n');
  failures.forEach(function (f) { console.error('  ' + f + '\n'); });
  process.exit(1);
}
console.log('\ngate passed');
