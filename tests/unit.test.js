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
  A.ok(/rough/i.test(p.msg));
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
t('getProgression edge: a new weight hitting target on its own session does not progress', function () {
  // A single session at 35 lbs meeting reps+RPE should not count toward the
  // 2-session rule when the prior qualifying session was at 30 lbs.
  var p = M.getProgression('row', [
    log({ ago: 2, sets: [[35, 12, 7], [35, 12, 7]] }),
    log({ ago: 5, sets: [[30, 12, 7], [30, 12, 7]] })
  ], READY, 10);
  A.ok(!p || p.type !== 'progress', 'expected no progression, got: ' + JSON.stringify(p));
});
t('getProgression edge: RPE-only exercises also require the same weight both sessions', function () {
  // carry-a config: { top: 0, inc: 5, rpe: 7 }
  var p = M.getProgression('carry-a', [
    log({ ago: 2, id: 'carry-a', sets: [[40, 40, 7]] }),
    log({ ago: 5, id: 'carry-a', sets: [[35, 40, 7]] })
  ], READY, 10);
  A.ok(!p || p.type !== 'progress', 'expected no progression, got: ' + JSON.stringify(p));
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

// --- deriveCycleState (row 43) ----------------------------------------
// Logs at local noon on a given day, newest-first like the app stores them.
function at(day, session, manual) { return { date: new Date(day + 'T12:00:00').toISOString(), session: session, manual: !!manual, exercises: [] }; }
// What saveAndFinish used to store after saving these sessions in this order.
function chain(list) {
  return list.reduce(function (st, p) { return M.nextCycleState(st, p[1], p[0]); },
    { lastSession: null, lastDate: null, isDoubleDay: false, completedToday: [] });
}
t('deriveCycleState: matches the old saved chain for a plain cycle', function () {
  var seq = [['2026-11-01', 'A'], ['2026-11-03', 'B'], ['2026-11-05', 'C']];
  var logs = seq.slice().reverse().map(function (p) { return at(p[0], p[1]); });
  var d = M.deriveCycleState(logs, '2026-11-05');
  A.deepStrictEqual(d, chain(seq));
  A.strictEqual(M.computeNextSession(d), 'A');
});
t('deriveCycleState: deleting the newest log steps Next Up back', function () {
  var logs = [at('2026-11-05', 'C'), at('2026-11-03', 'B'), at('2026-11-01', 'A')];
  A.strictEqual(M.computeNextSession(M.deriveCycleState(logs, '2026-11-06')), 'A');
  A.strictEqual(M.computeNextSession(M.deriveCycleState(logs.slice(1), '2026-11-06')), 'C');
});
t('deriveCycleState: no logs means a fresh start at A', function () {
  var d = M.deriveCycleState([], '2026-11-06');
  A.strictEqual(d.lastSession, null);
  A.strictEqual(M.computeNextSession(d), 'A');
});
t('deriveCycleState: an imported older file gives that file\'s Next Up', function () {
  var older = [at('2026-10-02', 'A'), at('2026-10-01', 'C')];
  A.strictEqual(M.computeNextSession(M.deriveCycleState(older, '2026-11-06')), 'B');
});
t('deriveCycleState: TGU in the middle of a cycle resumes it', function () {
  var logs = [at('2026-11-04', 'TGU'), at('2026-11-03', 'B'), at('2026-11-01', 'A')];
  var d = M.deriveCycleState(logs, '2026-11-05');
  A.strictEqual(d.lastSession, 'TGU');
  A.strictEqual(M.computeNextSession(d), 'C');
});
t('deriveCycleState: A and B on one day give Modified C next, and only today counts as today', function () {
  var logs = [at('2026-11-05', 'B'), at('2026-11-05', 'A'), at('2026-11-03', 'C')];
  var same = M.deriveCycleState(logs, '2026-11-05');
  A.strictEqual(same.isDoubleDay, true);
  A.deepStrictEqual(same.completedToday, ['A', 'B']);
  var next = M.deriveCycleState(logs, '2026-11-06');
  A.deepStrictEqual(next.completedToday, [], 'yesterday is not today');
  A.strictEqual(M.computeNextSession(next), 'modC');
  var after = M.deriveCycleState([at('2026-11-06', 'modC')].concat(logs), '2026-11-06');
  A.strictEqual(after.isDoubleDay, false);
  A.strictEqual(M.computeNextSession(after), 'A');
});
t('deriveCycleState: a manual log counts like a finished one', function () {
  var logs = [at('2026-11-04', 'A', true)];
  A.strictEqual(M.computeNextSession(M.deriveCycleState(logs, '2026-11-05')), 'B');
});

// --- getFatigueTrend: untapped Feel (row 63) ------------------------------
t('getFatigueTrend: sessions where Feel was never tapped do not count as low readiness', function () {
  var ok = { sleep: 2, soreness: 2, motivation: 2 };
  var logs = [
    log({ ago: 1, sessionRPE: 8, readiness: ok }),
    log({ ago: 3, sessionRPE: 8 }),
    log({ ago: 5, sessionRPE: 8 })
  ];
  A.strictEqual(M.getFatigueTrend(logs), null);
  var rough = { sleep: 1, soreness: 1, motivation: 1 };
  var low = [log({ ago: 1, sessionRPE: 8, readiness: rough }), log({ ago: 3, sessionRPE: 8 }), log({ ago: 5, sessionRPE: 8 })];
  A.ok(M.getFatigueTrend(low), 'a tapped Rough with high RPE still warns');
});

// --- countTrainingToday ------------------------------------------------
t('countTrainingToday: counts A, B, C and Modified C, not TGU', function () {
  A.strictEqual(M.countTrainingToday(['A', 'B', 'C', 'modC']), 4);
  A.strictEqual(M.countTrainingToday(['TGU']), 0, 'a TGU alone is not a first session');
  A.strictEqual(M.countTrainingToday(['TGU', 'A']), 1);
  A.strictEqual(M.countTrainingToday(undefined), 0);
});
t('nextCycleState: TGU then A on one day is not a double day', function () {
  var s = M.nextCycleState({ lastSession: null, lastDate: null, completedToday: [] }, 'TGU', '2026-09-16');
  s = M.nextCycleState(s, 'A', '2026-09-16');
  A.strictEqual(s.isDoubleDay, false);
  A.strictEqual(M.nextCycleState(s, 'B', '2026-09-16').isDoubleDay, true);
});

// === Spine: cycle state -> recommendation -> progression -> debrief =====
// Every serious bug the reviews found sat on this chain. The fixtures below
// run against a small seeded history and against getRec, getRecReason and the
// debrief lines sliced verbatim out of App (extract.js appSlices).

var TODAY = M.getLocalDateKey();
var FEEL = {};
M.FEEL.forEach(function (f) { FEEL[f.key] = f.rd; });

// One session log with several exercises: { exId: [[w, reps, rpe], ...] }.
function sess(ago, key, exs, extra) {
  var l = {
    date: daysAgo(ago), session: key,
    exercises: Object.keys(exs).map(function (id) {
      return { id: id, sets: exs[id].map(function (s) {
        return { weight: s[0], reps: s[1], rpe: s[2], completed: true };
      }) };
    })
  };
  return Object.assign(l, extra || {});
}
function x3(w, reps, rpe) { return [[w, reps, rpe], [w, reps, rpe], [w, reps, rpe]]; }

// Seeded history, newest first: a normal A -> B -> C run ending in C, with
// row and BSS each at a working weight they have held for two sessions.
var SEED = [
  sess(2, 'C', { 'bss-c': x3(30, 10, 8), 'pullup': x3(0, 6, 9), 'sldl-c': x3(40, 9, 8) }),
  sess(4, 'B', { 'sldl-b': x3(40, 8, 8), 'row': x3(30, 12, 8), 'carry-b': x3(35, 40, 7) }),
  sess(6, 'A', { 'bss-a': x3(25, 10, 7), 'pushup': x3(0, 12, 7), 'carry-a': x3(35, 40, 7) }),
  sess(9, 'C', { 'bss-c': x3(25, 10, 8), 'pullup': x3(0, 5, 9), 'sldl-c': x3(35, 10, 7) }),
  sess(11, 'B', { 'sldl-b': x3(35, 10, 7), 'row': x3(30, 12, 7), 'carry-b': x3(30, 40, 7) }),
  sess(13, 'A', { 'bss-a': x3(25, 10, 7), 'pushup': x3(0, 10, 7), 'carry-a': x3(30, 40, 7) })
];

// --- cycle state: nextCycleState / computeNextSession ------------------
t('spine cycle: a walk through A, B, C, a double day, TGU and Modified C', function () {
  var steps = [
    ['2026-09-01', 'A', 'B'], ['2026-09-03', 'B', 'C'], ['2026-09-05', 'C', 'A'],
    ['2026-09-07', 'A', 'B'], ['2026-09-07', 'B', 'modC'],
    ['2026-09-08', 'TGU', 'modC'], ['2026-09-09', 'modC', 'A'], ['2026-09-11', 'A', 'B']
  ];
  var s = { lastSession: null, lastDate: null, isDoubleDay: false, completedToday: [] };
  A.strictEqual(M.computeNextSession(s), 'A');
  steps.forEach(function (st) {
    s = M.nextCycleState(s, st[1], st[0]);
    A.strictEqual(M.computeNextSession(s), st[2], 'after ' + st[1] + ' on ' + st[0]);
  });
});
t('spine cycle: a TGU on the double day itself keeps Modified C owed', function () {
  var s = M.nextCycleState({ lastSession: 'C', lastDate: '2026-09-06', completedToday: ['C'] }, 'A', '2026-09-07');
  s = M.nextCycleState(s, 'B', '2026-09-07');
  s = M.nextCycleState(s, 'TGU', '2026-09-07');
  A.strictEqual(s.preTgu, 'modC');
  A.strictEqual(M.computeNextSession(s), 'modC');
  s = M.nextCycleState(s, 'modC', '2026-09-08');
  A.strictEqual(s.isDoubleDay, false);
  A.strictEqual(M.computeNextSession(s), 'A');
});
t('spine cycle: Modified C then A continues the rotation at B', function () {
  var s = M.nextCycleState({ lastSession: 'B', lastDate: '2026-09-07', isDoubleDay: true, completedToday: ['A', 'B'] }, 'modC', '2026-09-08');
  A.strictEqual(M.computeNextSession(s), 'A');
  s = M.nextCycleState(s, 'A', '2026-09-10');
  A.strictEqual(s.isDoubleDay, false);
  A.deepStrictEqual(s.completedToday, ['A']);
  A.strictEqual(M.computeNextSession(s), 'B');
});
t('spine cycle: Modified C then A on the same day is not a double day', function () {
  var s = M.nextCycleState({ lastSession: 'B', lastDate: '2026-09-07', isDoubleDay: true, completedToday: ['A', 'B'] }, 'modC', '2026-09-08');
  s = M.nextCycleState(s, 'A', '2026-09-08');
  A.strictEqual(s.isDoubleDay, false);
  A.strictEqual(M.computeNextSession(s), 'B');
});
t('spine cycle: day rollover drops yesterday\'s sessions but keeps the rotation', function () {
  var s = M.nextCycleState({ lastSession: null, lastDate: null, completedToday: [] }, 'A', '2026-09-07');
  s = M.nextCycleState(s, 'B', '2026-09-08');
  A.strictEqual(s.isDoubleDay, false, 'A yesterday and B today is not a double day');
  A.deepStrictEqual(s.completedToday, ['B']);
  A.strictEqual(s.lastDate, '2026-09-08');
  A.strictEqual(M.computeNextSession(s), 'C');
  // Days off never reset the cycle.
  s = M.nextCycleState(s, 'C', '2026-09-20');
  A.strictEqual(M.computeNextSession(s), 'A');
});

// --- getRec / getRecReason ---------------------------------------------
t('spine rec: no history recommends A as the first session', function () {
  A.deepStrictEqual(M.recFor({ lastSession: null, completedToday: [] }),
    { rec: 'A', reason: 'First session → starting with A' });
});
t('spine rec: after A, B or C the next in the rotation, naming the last one', function () {
  [['A', 'B'], ['B', 'C'], ['C', 'A']].forEach(function (p) {
    A.deepStrictEqual(M.recFor({ lastSession: p[0], completedToday: [] }),
      { rec: p[1], reason: 'Last completed: Session ' + p[0] });
  });
});
t('spine rec: after Modified C the cycle restarts at A', function () {
  A.deepStrictEqual(M.recFor({ lastSession: 'modC', completedToday: [] }),
    { rec: 'A', reason: 'Last was Modified C → restarting cycle at A' });
});
t('spine rec: after TGU the cycle resumes where it was, or resets to A', function () {
  A.deepStrictEqual(M.recFor({ lastSession: 'TGU', preTgu: 'C', completedToday: [] }),
    { rec: 'C', reason: 'Last was TGU → resuming cycle' });
  A.deepStrictEqual(M.recFor({ lastSession: 'TGU', preTgu: 'modC', completedToday: [] }),
    { rec: 'modC', reason: 'Last was TGU → resuming cycle' });
  A.deepStrictEqual(M.recFor({ lastSession: 'TGU', completedToday: [] }),
    { rec: 'A', reason: 'Cycle reset to A' });
});
t('spine rec: a double day recommends Modified C, the same day and the next', function () {
  A.deepStrictEqual(M.recFor({ lastSession: 'B', isDoubleDay: true, completedToday: ['A', 'B'] }),
    { rec: 'modC', reason: 'Double day → Modified C' });
  A.deepStrictEqual(M.recFor({ lastSession: 'B', isDoubleDay: true, completedToday: [] }),
    { rec: 'modC', reason: 'Double day → Modified C' });
});
t('spine rec: an unrecognised last session resets to A and says so', function () {
  A.deepStrictEqual(M.recFor({ lastSession: 'bogus', completedToday: [] }),
    { rec: 'A', reason: 'Cycle reset to A' });
});

// --- Feel: the Rough-readiness hold ------------------------------------
t('spine feel: Rough holds the load on a history that would progress', function () {
  var p = M.getProgression('row', SEED, FEEL.rough, SEED.length);
  A.strictEqual(p.type, 'maintain');
  var s = M.getSuggestedLoad('row', SEED, FEEL.rough, SEED.length, false);
  A.strictEqual(s.weight, 30, 'held at the last working weight');
  A.ok(/rough/i.test(s.reason), s.reason);
});
t('spine feel: OK, Good and no tap all progress the same history', function () {
  [FEEL.ok, FEEL.good, null].forEach(function (rd) {
    var s = M.getSuggestedLoad('row', SEED, rd, SEED.length, false);
    A.strictEqual(s.weight, 35, 'readiness ' + JSON.stringify(rd));
  });
});

// --- getProgression: top-reps branch -----------------------------------
t('spine progression: exactly top reps at exactly target RPE twice qualifies', function () {
  // row: top 12, rpe 8. SEED's last two rows are 30x12 @8 and @7.
  var p = M.getProgression('row', SEED, FEEL.ok, SEED.length);
  A.strictEqual(p.type, 'progress');
  A.strictEqual(p.weight, 35);
});
t('spine progression: RPE 10 at target reps holds the load', function () {
  var logs = [sess(1, 'B', { row: x3(30, 12, 10) })].concat(SEED);
  var p = M.getProgression('row', logs, FEEL.ok, logs.length);
  A.strictEqual(p.type, 'maintain');
  A.ok(/RPE above target/.test(p.msg), p.msg);
});
t('spine progression: an RPE 10 session one back also blocks the +5', function () {
  var logs = [sess(1, 'B', { row: x3(30, 12, 7) }), sess(3, 'B', { row: x3(30, 12, 10) })];
  var p = M.getProgression('row', logs, FEEL.ok, 2);
  A.ok(!p || p.type !== 'progress', JSON.stringify(p));
});
t('spine progression: same-weight rule, top reps at a new weight starts the count over', function () {
  // BSS: 25 then 30, both at top reps and target RPE -- one session at 30 only.
  var logs = [sess(1, 'A', { 'bss-a': x3(30, 10, 7) }), sess(3, 'C', { 'bss-c': x3(25, 10, 7) })];
  var p = M.getProgression('bss-a', logs, FEEL.ok, 2);
  A.ok(!p || p.type !== 'progress', JSON.stringify(p));
  // A second session at 30 completes it; bss-a and bss-c count together.
  logs = [sess(0, 'C', { 'bss-c': x3(30, 10, 8) })].concat(logs);
  p = M.getProgression('bss-a', logs, FEEL.ok, 3);
  A.strictEqual(p.type, 'progress');
  A.strictEqual(p.weight, 35);
});
t('spine progression: one heavy outlier set does not move the working weight', function () {
  var logs = [
    sess(1, 'B', { row: [[30, 12, 8], [30, 12, 8], [35, 12, 8]] }),
    sess(3, 'B', { row: x3(30, 12, 8) })
  ];
  var p = M.getProgression('row', logs, FEEL.ok, 2);
  A.strictEqual(p.type, 'progress');
  A.strictEqual(p.weight, 35, 'progresses from the working weight 30, not the 35 outlier');
});
t('spine progression: below top reps, or no RPE logged, never progresses', function () {
  var short = [sess(1, 'B', { row: x3(30, 11, 7) }), sess(3, 'B', { row: x3(30, 11, 7) })];
  A.strictEqual(M.getProgression('row', short, FEEL.ok, 2), null);
  var noRpe = [sess(1, 'B', { row: x3(30, 12, '') }), sess(3, 'B', { row: x3(30, 12, '') })];
  A.strictEqual(M.getProgression('row', noRpe, FEEL.ok, 2), null);
});
t('spine progression: reps falling at the same weight is a caution', function () {
  var logs = [sess(1, 'B', { row: x3(30, 9, 8) }), sess(3, 'B', { row: x3(30, 11, 8) })];
  var p = M.getProgression('row', logs, FEEL.ok, 2);
  A.strictEqual(p.type, 'caution');
});

// --- getProgression: RPE-only branch (carries) -------------------------
t('spine progression: carries progress on two same-weight sessions at target RPE', function () {
  // carry-a / carry-b / carry-mc are one group; SEED has 35 @7 in A and B.
  var p = M.getProgression('carry-mc', SEED, FEEL.ok, SEED.length);
  A.strictEqual(p.type, 'progress');
  A.strictEqual(p.weight, 40);
});
t('spine progression: carries at RPE 8 hold, and without RPE never progress', function () {
  var hard = [sess(1, 'A', { 'carry-a': x3(35, 40, 8) })].concat(SEED);
  A.strictEqual(M.getProgression('carry-a', hard, FEEL.ok, 7).type, 'maintain');
  var noRpe = [sess(1, 'A', { 'carry-a': x3(35, 40, 0) }), sess(3, 'B', { 'carry-b': x3(35, 40, 0) })];
  A.strictEqual(M.getProgression('carry-a', noRpe, FEEL.ok, 2), null);
});

// --- getFatigueTrend: three sessions rising, flat, falling -------------
function rpeRun(rpes, rd) {   // newest first
  return rpes.map(function (r, i) {
    return sess(1 + i * 2, 'A', { 'bss-a': x3(30, 10, r) }, { sessionRPE: r, readiness: rd });
  });
}
t('spine fatigue: rising 7 -> 8 -> 9 fires, from set RPE when sessionRPE is absent', function () {
  var logs = rpeRun([9, 8, 7], FEEL.good).map(function (l) { delete l.sessionRPE; return l; });
  var r = M.getFatigueTrend(logs);
  A.ok(r && /RPE rising/.test(r.msg), JSON.stringify(r));
});
t('spine fatigue: rising but ending below 8 stays quiet', function () {
  A.strictEqual(M.getFatigueTrend(rpeRun([7.5, 6.5, 6], FEEL.good)), null);
});
t('spine fatigue: flat at RPE 8 is quiet with OK readiness, fires with Rough', function () {
  A.strictEqual(M.getFatigueTrend(rpeRun([8, 8, 8], FEEL.ok)), null);
  var r = M.getFatigueTrend(rpeRun([8, 8, 8], FEEL.rough));
  A.ok(r && /low readiness/.test(r.msg), JSON.stringify(r));
});
t('spine fatigue: falling 9 -> 8 -> 7 stays quiet', function () {
  A.strictEqual(M.getFatigueTrend(rpeRun([7, 8, 9], FEEL.ok)), null);
});
t('spine fatigue: sessions with no RPE at all are skipped, not counted', function () {
  var logs = rpeRun([9, 8, 7], FEEL.good);
  logs.splice(1, 0, sess(2, 'B', { row: x3(30, 12, 0) }));
  var r = M.getFatigueTrend(logs);
  A.ok(r && /RPE rising/.test(r.msg), JSON.stringify(r));
});

// --- debrief: next session and load advice from today's sets -----------
function debrief(o) {
  return M.debriefFor({
    session: o.session, logs: o.logs || SEED, readiness: o.readiness,
    cycleState: o.state || { lastSession: 'C', lastDate: '2026-09-26', completedToday: [] },
    exData: Object.keys(o.sets).reduce(function (acc, id) {
      acc[id] = o.sets[id].map(function (s) {
        return { weight: s[0], reps: s[1], rpe: s[2], completed: s[3] !== false };
      });
      return acc;
    }, {})
  });
}
function line(d, name) {
  return d.debrief.find(function (l) { return l.indexOf(name + ':') === 0; });
}
t('spine debrief: finishing A names B next, not A', function () {
  var d = debrief({ session: 'A', sets: { 'bss-a': x3(30, 10, 8), pushup: x3(0, 12, 7), 'carry-a': x3(35, 40, 7) } });
  A.strictEqual(d.next, 'B');
  A.ok(/^Next: Session B/.test(d.debrief[d.debrief.length - 1]), d.debrief.join(' | '));
});
t('spine debrief: the balance advisory counts the session just finished', function () {
  var logs = [sess(1, 'C', {}), sess(2, 'B', {}), sess(3, 'C', {}), sess(4, 'B', {}), sess(5, 'C', {}), sess(6, 'B', {})];
  var d = debrief({ session: 'A', logs: logs, sets: { 'bss-a': x3(30, 10, 8), pushup: x3(0, 12, 7), 'carry-a': x3(35, 40, 7) } });
  A.strictEqual(d.debrief[d.debrief.length - 1], 'Next: Session B');
});
t('spine debrief: the second cycle session of a day names Modified C next', function () {
  var d = debrief({
    session: 'B', state: { lastSession: 'A', lastDate: TODAY, completedToday: ['A'] },
    sets: { 'sldl-b': x3(40, 8, 8), row: x3(30, 12, 8), 'carry-b': [] }
  });
  A.strictEqual(d.next, 'modC');
  A.strictEqual(d.pendingState.isDoubleDay, true);
  A.strictEqual(line(d, 'Carries'), 'Carries: skipped (double-day grip management)');
});
t('spine debrief: finishing TGU names the session it interrupted', function () {
  var d = debrief({ session: 'TGU', state: { lastSession: 'B', lastDate: '2026-09-26', completedToday: [] }, sets: { tgu: [[20, 5, 7]] } });
  A.strictEqual(d.next, 'C');
});
t('spine debrief: Modified C the day after a double day names A next', function () {
  var d = debrief({
    session: 'modC', state: { lastSession: 'B', lastDate: '2026-09-27', isDoubleDay: true, completedToday: ['A', 'B'] },
    sets: { ohp: x3(20, 8, 8), 'pullup-mc': x3(0, 6, 9), 'carry-mc': x3(35, 40, 7) }
  });
  A.strictEqual(d.next, 'A');
  A.strictEqual(d.pendingState.isDoubleDay, false);
});
t('spine debrief: today\'s second qualifying session earns the +5', function () {
  // SEED has one BSS session at 30 (top reps, RPE 8): alone it is not enough.
  A.ok(!M.getProgression('bss-a', SEED, FEEL.ok, 6) || M.getProgression('bss-a', SEED, FEEL.ok, 6).type !== 'progress');
  var d = debrief({ session: 'A', sets: { 'bss-a': x3(30, 10, 8), pushup: x3(0, 12, 7), 'carry-a': x3(35, 40, 7) } });
  A.strictEqual(line(d, 'Bulgarian Split Squats'), 'Bulgarian Split Squats: start at 35 next session');
  A.strictEqual(line(d, 'Push-Ups'), 'Push-Ups: 3 sets done');
});
t('spine debrief: an RPE 10 grind today holds, though history alone said +5', function () {
  // SEED's rows qualify for 35 before today; today 30x12 at RPE 10.
  A.strictEqual(M.getProgression('row', SEED, FEEL.ok, 6).type, 'progress');
  var d = debrief({ session: 'B', state: { lastSession: 'A', lastDate: '2026-09-26', completedToday: [] },
    sets: { 'sldl-b': x3(40, 8, 8), row: x3(30, 12, 10), 'carry-b': x3(35, 40, 7) } });
  A.strictEqual(line(d, 'Single-Arm Rows'), 'Single-Arm Rows: hold at 30');
});
t('spine debrief: hold at is the working weight, not one heavy outlier set', function () {
  var logs = [sess(1, 'B', { row: x3(30, 8, 8) })];
  var d = debrief({ session: 'B', logs: logs, state: { lastSession: 'A', lastDate: '2026-09-26', completedToday: [] },
    sets: { 'sldl-b': x3(40, 8, 8), row: [[30, 10, 8], [30, 10, 8], [35, 6, 9]], 'carry-b': x3(35, 40, 7) } });
  A.strictEqual(line(d, 'Single-Arm Rows'), 'Single-Arm Rows: hold at 30');
});
t('spine debrief: reps falling today at the same weight is flagged', function () {
  var d = debrief({ session: 'B', state: { lastSession: 'A', lastDate: '2026-09-26', completedToday: [] },
    sets: { 'sldl-b': x3(40, 6, 8), row: x3(30, 12, 8), 'carry-b': x3(35, 40, 7) } });
  A.strictEqual(line(d, 'Single-Leg Deadlifts'), 'Single-Leg Deadlifts: Reps dropped at same weight — check form');
});
t('spine debrief: Rough today holds a load that would otherwise progress', function () {
  var d = debrief({ session: 'A', readiness: FEEL.rough,
    sets: { 'bss-a': x3(30, 10, 8), pushup: x3(0, 12, 7), 'carry-a': x3(35, 40, 7) } });
  A.strictEqual(line(d, 'Bulgarian Split Squats'), 'Bulgarian Split Squats: hold at 30');
});
t('spine debrief: the +5 it promises is the load the next Game Plan prefills', function () {
  var sets = { 'bss-a': x3(30, 10, 8), pushup: x3(0, 12, 7), 'carry-a': x3(35, 40, 7) };
  var d = debrief({ session: 'A', sets: sets });
  var saved = [sess(0, 'A', sets)].concat(SEED);
  A.strictEqual(M.getSuggestedLoad('bss-c', saved, null, 7, false).weight, 35);
  A.ok(/start at 35/.test(line(d, 'Bulgarian Split Squats')));
});
t('history chart: a session point is the working weight, not the heaviest set', function () {
  var pts = M.getExHistory('row', [log({ ago: 1, id: 'row', sets: [[30, 10, 8], [30, 10, 8], [35, 6, 9]] })]);
  A.strictEqual(pts[pts.length - 1].weight, 30);
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
