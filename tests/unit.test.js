// Fixtures for the pure functions in sections 4 and 5 of index.html.
//
// The functions are loaded by slicing the inline script between the `// 4.`
// and `// 6.` section headers into a temp CommonJS module (see extract.js).
// index.html is never modified to make this work.
//
// Log shape reminder: logs are NEWEST FIRST. logs[0] is the most recent
// session. Every fixture below is written in that order.
'use strict';
var ex = require('./extract.js');
var A = require('assert');

var M = require(ex.tmpFile('pure.cjs', ex.buildPureModule()));

var DAY = 864e5;
function daysAgo(n) { return new Date(Date.now() - n * DAY).toISOString(); }

// A session log with one exercise, whose sets are [weight, reps, rpe].
function log(opts) {
  return {
    date: opts.date || daysAgo(opts.ago == null ? 1 : opts.ago),
    session: opts.session || 'B',
    manual: !!opts.manual,
    readiness: opts.readiness,
    sessionRPE: opts.sessionRPE,
    exercises: opts.exercises || [{
      id: opts.id || 'row',
      sets: (opts.sets || []).map(function (s) {
        return {
          weight: s[0], reps: s[1], rpe: s[2],
          completed: s[3] === undefined ? true : s[3]
        };
      })
    }]
  };
}

var READY = { sleep: 3, soreness: 3, motivation: 3 };   // 9/9
var WIPED = { sleep: 1, soreness: 1, motivation: 1 };   // 3/9

var passed = 0, failed = [];
function t(name, fn) {
  try { fn(); passed++; console.log('  ok   ' + name); }
  catch (err) { failed.push([name, err]); console.log('  FAIL ' + name); }
}

// --- calcE1RM ----------------------------------------------------------
t('calcE1RM: Epley formula, rounded', function () {
  A.strictEqual(M.calcE1RM(100, 5), 117);   // 100 * (1 + 5/30) = 116.67
  A.strictEqual(M.calcE1RM(30, 12), 42);
});
t('calcE1RM edge: a single rep is its own 1RM, junk input is 0', function () {
  A.strictEqual(M.calcE1RM(135, 1), 135);   // r === 1 short-circuits
  A.strictEqual(M.calcE1RM(0, 5), 0);
  A.strictEqual(M.calcE1RM(100, 0), 0);
  A.strictEqual(M.calcE1RM(-50, 5), 0);
});

// --- getProgression ----------------------------------------------------
// 'row' config: { top: 12, inc: 5, rpe: 8 }
var twoGoodRowSessions = [
  log({ ago: 2, sets: [[30, 12, 7], [30, 12, 7]] }),
  log({ ago: 5, sets: [[30, 12, 7], [30, 12, 7]] })
];

t('getProgression: two sessions at target reps and RPE means add weight', function () {
  var p = M.getProgression('row', twoGoodRowSessions, READY, 10);
  A.strictEqual(p.type, 'progress');
  A.strictEqual(p.weight, 35);              // 30 + inc 5
  A.ok(/35 lbs/.test(p.msg), 'message names the new weight: ' + p.msg);
});
t('getProgression edge: low readiness overrides a qualifying history', function () {
  var p = M.getProgression('row', twoGoodRowSessions, WIPED, 10);
  A.strictEqual(p.type, 'maintain');
  A.ok(/Readiness/.test(p.msg));
});
t('getProgression edge: one session of history is not enough', function () {
  A.strictEqual(M.getProgression('row', [twoGoodRowSessions[0]], READY, 10), null);
  A.strictEqual(M.getProgression('row', [], READY, 10), null);
});
t('getProgression edge: bodyweight exercises never progress by load', function () {
  // pushup has inc 0 -- there is no weight to add.
  A.strictEqual(M.getProgression('pushup', twoGoodRowSessions, READY, 10), null);
  A.strictEqual(M.getProgression('no-such-exercise', twoGoodRowSessions, READY, 10), null);
});
t('getProgression: RPE above target holds the load', function () {
  var p = M.getProgression('row', [
    log({ ago: 2, sets: [[30, 12, 9], [30, 12, 9]] }),
    log({ ago: 5, sets: [[30, 12, 7], [30, 12, 7]] })
  ], READY, 10);
  A.strictEqual(p.type, 'maintain');
});

// --- getSuggestedLoad --------------------------------------------------
t('getSuggestedLoad: follows the progression engine when it fires', function () {
  var s = M.getSuggestedLoad('row', twoGoodRowSessions, READY, 10, false);
  A.strictEqual(s.weight, 35);
  A.ok(s.reason);
});
t('getSuggestedLoad: falls back to last working weight', function () {
  var s = M.getSuggestedLoad('row', [
    log({ ago: 2, sets: [[30, 8, 9]] })
  ], READY, 10, false);
  A.strictEqual(s.weight, 30);
});
t('getSuggestedLoad edge: no history and bodyweight both return null', function () {
  A.strictEqual(M.getSuggestedLoad('row', [], READY, 10, false), null);
  A.strictEqual(M.getSuggestedLoad('pushup', twoGoodRowSessions, READY, 10, false), null);
});
t('getSuggestedLoad: a second session today advises maintaining', function () {
  var s = M.getSuggestedLoad('carry-a', [
    log({ ago: 1, id: 'carry-a', sets: [[35, 40, 7]] })
  ], READY, 10, true);
  A.strictEqual(s.weight, 35);
  A.ok(/maintain or lighten/i.test(s.reason), s.reason);
});

// --- calcACWR ----------------------------------------------------------
t('calcACWR: acute over chronic, both windows counted', function () {
  // One session inside both windows: 2 sets x 30lb x 12 = 720.
  // acute = 720, chronic = 720 / 4 = 180, ratio = 4.
  var r = M.calcACWR([log({ ago: 1, sets: [[30, 12, 7], [30, 12, 7]] })]);
  A.strictEqual(r, 4);
});
t('calcACWR edge: too little chronic volume returns null, not Infinity', function () {
  A.strictEqual(M.calcACWR([]), null);
  A.strictEqual(M.calcACWR([log({ ago: 40, sets: [[30, 12, 7]] })]), null);
});

// --- shouldDeload ------------------------------------------------------
function deloadLogs(rpes, readinessSums) {
  return rpes.map(function (rpe, i) {
    return log({
      ago: i * 3 + 1,
      sets: [[30, 10, rpe]],
      readiness: { sleep: readinessSums[i], soreness: 0, motivation: 0 }
    });
  });
}
t('shouldDeload: RPE climbing while readiness falls', function () {
  A.strictEqual(
    M.shouldDeload(deloadLogs([9, 8.5, 8, 7.5, 7, 6.5], [3, 4, 5, 6, 7, 8])),
    true
  );
});
t('shouldDeload edge: needs six sessions, and flat data never fires', function () {
  A.strictEqual(M.shouldDeload([]), false);
  A.strictEqual(
    M.shouldDeload(deloadLogs([8, 8, 8, 8, 8], [5, 5, 5, 5, 5])), false);
  A.strictEqual(
    M.shouldDeload(deloadLogs([7, 7, 7, 7, 7, 7], [5, 5, 5, 5, 5, 5])), false);
});

// --- getFatigueTrend ---------------------------------------------------
t('getFatigueTrend: monotonic RPE rise of 1.5+ ending at 8 or above', function () {
  var r = M.getFatigueTrend([
    log({ ago: 1, sessionRPE: 9, sets: [[30, 10, 9]] }),
    log({ ago: 4, sessionRPE: 8.5, sets: [[30, 10, 8.5]] }),
    log({ ago: 7, sessionRPE: 7, sets: [[30, 10, 7]] })
  ]);
  A.ok(r && /RPE rising/.test(r.msg), JSON.stringify(r));
});
t('getFatigueTrend: sustained high effort against low readiness', function () {
  var r = M.getFatigueTrend([1, 4, 7].map(function (ago) {
    return log({
      ago: ago, sessionRPE: 8,
      readiness: { sleep: 1, soreness: 1, motivation: 1 },
      sets: [[30, 10, 8]]
    });
  }));
  A.ok(r && /low readiness/.test(r.msg), JSON.stringify(r));
});
t('getFatigueTrend edge: under three sessions, and manual logs are skipped', function () {
  A.strictEqual(M.getFatigueTrend([]), null);
  A.strictEqual(M.getFatigueTrend([
    log({ ago: 1, sessionRPE: 9, sets: [[30, 10, 9]] }),
    log({ ago: 4, sessionRPE: 8.5, sets: [[30, 10, 8.5]] })
  ]), null);
  // Three entries, but two are manual -- only one real session remains.
  A.strictEqual(M.getFatigueTrend([
    log({ ago: 1, sessionRPE: 9, sets: [[30, 10, 9]] }),
    log({ ago: 4, manual: true, sessionRPE: 8.5, sets: [[30, 10, 8.5]] }),
    log({ ago: 7, manual: true, sessionRPE: 7, sets: [[30, 10, 7]] })
  ]), null);
});

// --- detectPRs ---------------------------------------------------------
var rowHistory = [log({ ago: 5, sets: [[30, 10, 8]] })];

t('detectPRs: a heavier completed set is a weight and e1RM PR', function () {
  var prs = M.detectPRs('row', [
    { weight: 35, reps: 10, rpe: 8, completed: true }
  ], rowHistory);
  A.strictEqual(prs.length, 1);
  A.strictEqual(prs[0].setIdx, 0);
  A.ok(prs[0].reasons.indexOf('weight') !== -1, prs[0].reasons.join(','));
  A.ok(prs[0].reasons.indexOf('e1rm') !== -1, prs[0].reasons.join(','));
});
t('detectPRs edge: an unchecked set is never a PR', function () {
  A.deepStrictEqual(M.detectPRs('row', [
    { weight: 500, reps: 20, rpe: 8, completed: false }
  ], rowHistory), []);
});
t('detectPRs edge: matching a previous best is not a PR', function () {
  A.deepStrictEqual(M.detectPRs('row', [
    { weight: 30, reps: 10, rpe: 8, completed: true }
  ], rowHistory), []);
});

// --- getAllTimePRs -----------------------------------------------------
t('getAllTimePRs: best weight, reps and e1RM per group, with dates', function () {
  var heavyDate = daysAgo(3);
  var prs = M.getAllTimePRs([
    log({ date: heavyDate, sets: [[40, 6, 8]] }),
    log({ ago: 9, sets: [[30, 15, 7]] })
  ]);
  A.strictEqual(prs.row.bestWeight, 40);
  A.strictEqual(prs.row.bestWeightDate, heavyDate);
  A.strictEqual(prs.row.bestReps, 15);
  A.strictEqual(prs.row.bestE1RM, M.calcE1RM(40, 6));  // 48 > calcE1RM(30,15) = 45
});
t('getAllTimePRs edge: empty history yields zeroed records, not undefined', function () {
  var prs = M.getAllTimePRs([]);
  A.strictEqual(prs.row.bestWeight, 0);
  A.strictEqual(prs.row.bestWeightDate, null);
  A.strictEqual(prs.bss.bestE1RM, 0);
  A.ok(prs.pullup, 'every known group is present');
});
t('getAllTimePRs: session variants fold into one group (bss-a + bss-c)', function () {
  var prs = M.getAllTimePRs([
    log({ ago: 2, id: 'bss-a', sets: [[25, 10, 8]] }),
    log({ ago: 6, id: 'bss-c', sets: [[45, 8, 8]] })
  ]);
  A.strictEqual(prs.bss.bestWeight, 45);
});

// --- computeNextSession ------------------------------------------------
function next(s) { return M.computeNextSession(s); }
t('computeNextSession: no history starts at A, then A -> B -> C -> A', function () {
  A.strictEqual(next({ lastSession: null }), 'A');
  A.strictEqual(next({ lastSession: 'A' }), 'B');
  A.strictEqual(next({ lastSession: 'B' }), 'C');
  A.strictEqual(next({ lastSession: 'C' }), 'A');
});
t('computeNextSession: Modified C restarts at A; a double day recommends it', function () {
  A.strictEqual(next({ lastSession: 'modC' }), 'A');
  A.strictEqual(next({ lastSession: 'B', isDoubleDay: true }), 'modC');
});
t('computeNextSession: TGU resumes whatever was recommended before it', function () {
  ['A', 'B', 'C', 'modC'].forEach(function (p) {
    A.strictEqual(next({ lastSession: 'TGU', preTgu: p }), p, 'preTgu ' + p);
  });
  A.strictEqual(next({ lastSession: 'TGU' }), 'A', 'no preTgu');
});
t('computeNextSession edge: unrecognised values fall back to A, never undefined', function () {
  A.strictEqual(next({ lastSession: 'TGU', preTgu: 'bogus' }), 'A');
  A.strictEqual(next({ lastSession: 'bogus' }), 'A');
});

// --- nextCycleState ----------------------------------------------------
t('nextCycleState: A then B on one day sets isDoubleDay', function () {
  var s = M.nextCycleState({ lastSession: null, lastDate: null, completedToday: [] }, 'A', '2026-09-15');
  s = M.nextCycleState(s, 'B', '2026-09-15');
  A.strictEqual(s.isDoubleDay, true);
  A.deepStrictEqual(s.completedToday, ['A', 'B']);
});
t('nextCycleState: isDoubleDay expires on the first save after the day rolls over', function () {
  // completedToday deliberately not reset: the rollover effect has not run.
  var dbl = { lastSession: 'B', lastDate: '2026-09-15', isDoubleDay: true, completedToday: ['A', 'B'] };
  var s = M.nextCycleState(dbl, 'modC', '2026-09-16');
  A.strictEqual(s.isDoubleDay, false);
  A.deepStrictEqual(s.completedToday, ['modC']);
  var cyc = M.nextCycleState(dbl, 'C', '2026-09-16');
  A.strictEqual(cyc.isDoubleDay, false, 'a cycle session the next day is not a second session');
  var tgu = M.nextCycleState(dbl, 'TGU', '2026-09-16');
  A.strictEqual(tgu.isDoubleDay, false);
  A.strictEqual(tgu.preTgu, 'modC', 'the owed Modified C survives the TGU');
  A.strictEqual(M.computeNextSession(tgu), 'modC');
});

// --- summary -----------------------------------------------------------
console.log('');
if (failed.length) {
  failed.forEach(function (f) {
    console.error('FAIL ' + f[0]);
    console.error('  ' + (f[1].message || f[1]).split('\n').join('\n  ') + '\n');
  });
  console.error(failed.length + ' failed, ' + passed + ' passed');
  process.exit(1);
}
console.log(passed + ' passed');
