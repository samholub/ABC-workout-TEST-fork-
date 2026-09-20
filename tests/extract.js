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
  'getProgression', 'getSuggestedLoad', 'getFatigueTrend',
  // supporting functions the fixtures lean on
  'getWorkingWeight', 'getPeriodPhase', 'getSessionCount',
  'computeNextSession', 'nextCycleState',
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

// Reduce source text to what can change behaviour: lines that are wholly a
// comment (`//`, `/* */`, `<!-- -->`, including multi-line blocks) and blank
// lines are dropped, and each remaining line is trimmed. A line carrying code
// plus a trailing comment is kept as is, so editing it counts as a change.
function stripNonCode(text) {
  var out = [];
  var close = null; // terminator of the block comment we are inside
  text.split(/\r?\n/).forEach(function (raw) {
    var line = raw.trim();
    if (close) {
      var at = line.indexOf(close);
      if (at === -1) return;
      line = line.slice(at + close.length).trim();
      close = null;
    }
    while (line) {
      var end = null;
      if (line.indexOf('/*') === 0) end = '*/';
      else if (line.indexOf('<!--') === 0) end = '-->';
      if (!end) break;
      var e = line.indexOf(end, end === '*/' ? 2 : 4);
      if (e === -1) { close = end; line = ''; break; }
      line = line.slice(e + end.length).trim();
    }
    if (!line || line.indexOf('//') === 0) return;
    out.push(line);
  });
  return out.join('\n');
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
  stripNonCode: stripNonCode,
  tmpFile: tmpFile
};
