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

if (failures.length) {
  console.error('\ngate FAILED\n');
  failures.forEach(function (f) { console.error('  ' + f + '\n'); });
  process.exit(1);
}
console.log('\ngate passed');
