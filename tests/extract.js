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

// Build a CommonJS module out of sections 4 and 5 of the inline script, plus
// the recommendation and debrief lines sliced out of App (appSlices).
//
// Sections 4 and 5 are pure functions, but they close over four config values
// that live at the end of section 3 (PROG, EX_GROUP, EX_GROUP_NAMES and
// getGroupIds). We prepend that config block rather than moving it in
// index.html -- the app file stays exactly as it ships.
var EXPORTS = [
  'getProgression', 'getSuggestedLoad', 'getFatigueTrend',
  // supporting functions the fixtures lean on
  'getWorkingWeight', 'getExHistory', 'getPeriodPhase', 'getSessionCount',
  'computeNextSession', 'nextCycleState', 'deriveCycleState',
  'countTrainingToday', 'getBalanceAdvisory',
  // section 3 config the spine fixtures read
  'SESSIONS', 'FEEL', 'getLocalDateKey',
  // section 9 slices, wrapped below (see appSlices)
  'recFor', 'debriefFor'
];

// The first line of `text` matching `re`, verbatim.
function lineMatching(text, re, label) {
  var line = text.split(/\r?\n/).find(function (l) { return re.test(l); });
  if (line === undefined) throw new Error('line for ' + label + ' not found: ' + re);
  return line;
}

// Lines from the one after `after` through the first later line matching
// `through`, inclusive.
function sliceAfterThrough(text, after, through, label) {
  var lines = text.split(/\r?\n/);
  var a = lines.findIndex(function (l) { return after.test(l); });
  if (a === -1) throw new Error('start marker for ' + label + ' not found: ' + after);
  var b = lines.findIndex(function (l, i) { return i > a && through.test(l); });
  if (b === -1) throw new Error('end marker for ' + label + ' not found: ' + through);
  return lines.slice(a + 1, b + 1).join('\n');
}

// The recommendation and the debrief live inside App (section 9) as closures
// over its state. Their lines are copied verbatim into two wrapper functions
// that take that state as arguments, so the fixtures run the shipped code.
//   recFor(cycleState) -> { rec, reason }                   getRec, getRecReason
//   debriefFor(o)      -> { next, debrief, pendingState }   renderSessionComplete
//                         up to its "Next:" line, with buildSessionLog
function appSlices(script) {
  var getRec = lineMatching(script, /^var getRec=useCallback\(/, 'getRec');
  var reason = sliceBetween(script, /^var getRecReason=function\(\)\{/,
    /^var startSession=function/, 'getRecReason');
  var buildLog = lineMatching(script, /^var buildSessionLog=function/, 'buildSessionLog');
  var debrief = sliceAfterThrough(script, /^function renderSessionComplete\(\)\{/,
    /^debrief\.push\("Next: "/, 'debrief');
  return [
    'function recFor(cycleState){',
    'var useCallback=function(f){return f};',
    getRec, reason,
    'return {rec:getRec(),reason:getRecReason()}}',
    'function debriefFor(o){',
    'var currentSession=o.session,cycleState=o.cycleState,exData=o.exData,logs=o.logs,',
    'readiness=o.readiness||null,sessionCount=o.sessionCount||0,start=Date.now(),',
    'warmup=null,notes={notes:""},sessionRPE=0;',
    buildLog, debrief,
    'return {next:next,debrief:debrief,pendingState:pendingState}}'
  ].join('\n');
}

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
  // getBalanceAdvisory and the debrief read SESSIONS, the fixtures read FEEL,
  // and the debrief reads getLocalDateKey (section 1).
  return [
    '"use strict";',
    config,
    gidLine,
    cycleLine,
    lineMatching(script, /^var SESSIONS=/, 'SESSIONS'),
    lineMatching(script, /^var FEEL=/, 'FEEL'),
    lineMatching(script, /^function getLocalDateKey\(/, 'getLocalDateKey'),
    body,
    appSlices(script),
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
