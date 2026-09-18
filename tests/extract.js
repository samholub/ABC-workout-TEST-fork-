// Shared extraction helpers.
//
// index.html is a single-file app: the whole program is one inline <script>.
// Nothing here restructures that file -- we only slice text out of it, keyed
// on markers that already exist in the source (the `// N.` section headers).
'use strict';
var fs = require('fs');
var os = require('os');
var path = require('path');

var ROOT = path.join(__dirname, '..');

function readIndex() {
  return fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
}

// Returns the text of the Nth inline <script> (1-based, src= tags skipped).
function inlineScript(html, n) {
  var re = /<script([^>]*)>([\s\S]*?)<\/script>/g;
  var m, count = 0;
  while ((m = re.exec(html)) !== null) {
    if (/\ssrc\s*=/.test(m[1])) continue; // external, not inline
    count++;
    if (count === n) return m[2];
  }
  throw new Error('inline <script> #' + n + ' not found in index.html');
}

// Slice the lines of `text` from the line matching `from` up to (not
// including) the line matching `to`.
function sliceBetween(text, from, to, label) {
  var lines = text.split(/\r?\n/);
  var a = lines.findIndex(function (l) { return from.test(l); });
  var b = lines.findIndex(function (l) { return to.test(l); });
  if (a === -1) throw new Error('start marker for ' + label + ' not found: ' + from);
  if (b === -1) throw new Error('end marker for ' + label + ' not found: ' + to);
  if (b <= a) throw new Error('markers for ' + label + ' are out of order');
  return lines.slice(a, b).join('\n');
}

// Build a CommonJS module out of sections 4 and 5 of the inline script.
//
// Sections 4 and 5 are pure functions, but they close over four config values
// that live at the end of section 3 (PROG, EX_GROUP, EX_GROUP_NAMES and
// getGroupIds). We prepend that config block rather than moving it in
// index.html -- the app file stays exactly as it ships.
var EXPORTS = [
  'getProgression', 'getSuggestedLoad', 'calcE1RM', 'calcACWR',
  'shouldDeload', 'getFatigueTrend',
  // supporting functions the fixtures lean on
  'getWorkingWeight', 'getExE1RM', 'getPeriodPhase', 'getSessionCount',
  'calcTotalVolume', 'computeNextSession', 'nextCycleState',
  'countTrainingToday'
];

function buildPureModule() {
  var script = inlineScript(readIndex(), 2);
  var config = sliceBetween(
    script,
    /^\/\/ ===== PROGRESSION ENGINE CONFIG =====/,
    /^function getGroupIds/,
    'section 3 config'
  );
  // getGroupIds itself is the last line of the config block; include it.
  var gidLine = script.split(/\r?\n/).find(function (l) {
    return /^function getGroupIds/.test(l);
  });
  // The cycle helpers in section 5 read CYCLE, which is also in section 3.
  var cycleLine = script.split(/\r?\n/).find(function (l) {
    return /^var CYCLE=/.test(l);
  });
  var body = sliceBetween(script, /^\/\/ 4\./, /^\/\/ 6\./, 'sections 4-5');
  return [
    '"use strict";',
    config,
    gidLine,
    cycleLine,
    body,
    'module.exports = {' + EXPORTS.map(function (n) {
      return n + ': ' + n;
    }).join(', ') + '};'
  ].join('\n');
}

function tmpFile(name, contents) {
  var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'abc-harness-'));
  var p = path.join(dir, name);
  fs.writeFileSync(p, contents, 'utf8');
  return p;
}

module.exports = {
  ROOT: ROOT,
  readIndex: readIndex,
  inlineScript: inlineScript,
  sliceBetween: sliceBetween,
  buildPureModule: buildPureModule,
  tmpFile: tmpFile
};
