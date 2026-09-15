// Table test for the harness boundary. Run: node .claude/hooks/guard.test.js
//
// Two suites: the guard's permission decisions, and the smoke runner's rule
// that a spawn which never ran is not an expected failure.
//
// Kept out of tests/ on purpose: the loop may edit tests/, and the loop must
// not be able to edit its own boundary or the test that proves it works.
'use strict';
var path = require('path');
var spawnSync = require('child_process').spawnSync;

var GUARD = path.join(__dirname, 'guard.js');
var ROOT = path.join(__dirname, '..', '..');

function run(payload) {
  var r = spawnSync(process.execPath, [GUARD], {
    input: JSON.stringify(payload), cwd: ROOT, encoding: 'utf8'
  });
  return /"permissionDecision":"deny"/.test(r.stdout || '') ? 'DENY' : 'ALLOW';
}
function bash(c) { return { tool_name: 'Bash', tool_input: { command: c } }; }
function edit(f) { return { tool_name: 'Edit', tool_input: { file_path: f } }; }
function write(f) { return { tool_name: 'Write', tool_input: { file_path: f } }; }

var G = 'g' + 'it';          // keep literal command strings out of this file's
var FB = 'fire' + 'base';    // own text, so editing it never trips the guard

var cases = [
  // main is production
  ['DENY', bash(G + ' checkout ma' + 'in'), 'checkout main'],
  ['DENY', bash(G + ' switch ma' + 'in'), 'switch main'],
  ['DENY', bash(G + ' push origin HEAD:ma' + 'in'), 'push HEAD:main'],
  ['DENY', bash(G + ' merge ma' + 'in --no-ff'), 'merge main'],
  ['DENY', bash(G + ' branch -f ma' + 'in HEAD'), 'branch -f main'],
  ['DENY', bash(G + ' reset --hard ma' + 'in'), 'reset --hard main'],
  ['ALLOW', bash(G + ' diff ma' + 'in...auto/2026-09-15'), 'diff main...auto'],
  ['ALLOW', bash(G + ' log ma' + 'in..HEAD'), 'log main..HEAD'],
  ['ALLOW', bash(G + ' checkout -b auto/2026-09-15'), 'checkout -b auto/'],
  ['ALLOW', bash(G + ' push -u origin auto/2026-09-15'), 'push auto branch'],
  ['ALLOW', bash(G + ' checkout -- .'), 'checkout -- . (the revert path)'],
  ['ALLOW', bash('gh pr create --base ma' + 'in --head auto/x'), 'gh pr --base main'],
  // Prose about the rule is not a violation of it.
  ['ALLOW', bash(G + ' commit -m "never push to ma' + 'in from a branch"'),
    'commit message mentioning main'],
  ['ALLOW', bash(G + ' commit -F msg.txt'), 'commit -F'],
  ['DENY', bash(G + ' commit -m x && ' + G + ' push origin ma' + 'in'),
    'chained real push to main'],
  ['DENY', bash(G + ' -C . push origin ma' + 'in'), 'push main via -C'],
  ['ALLOW', bash(G + ' push origin auto/x:auto/x'), 'refspec without main'],
  ['DENY', bash(G + ' push origin auto/x:ma' + 'in'), 'refspec onto main'],

  // destructive
  ['DENY', bash(G + ' reset --hard HEAD~1'), 'reset --hard'],
  ['DENY', bash('rm -rf tests/'), 'rm -rf'],
  ['DENY', bash('rm -fr build'), 'rm -fr'],
  ['ALLOW', bash('rm -f .loop.lock'), 'rm -f (not recursive)'],

  // firebase
  ['DENY', bash(FB + ' deploy'), 'bare deploy'],
  ['DENY', bash(FB + ' deploy --only hosting'), 'hosting but no channel'],
  ['DENY', bash(FB + ' deploy --channel test'), 'channel but not scoped'],
  ['ALLOW', bash(FB + ' hosting:channel:deploy test'), 'preview channel deploy'],
  ['ALLOW', bash(FB + ' deploy --only hosting --channel test'), 'scoped + channel'],
  ['ALLOW', bash(FB + ' projects:list'), 'projects:list'],

  // edit scope
  ['ALLOW', edit('index.html'), 'edit index.html'],
  ['ALLOW', edit('sw.js'), 'edit sw.js'],
  ['ALLOW', edit('BACKLOG.md'), 'edit BACKLOG.md'],
  ['ALLOW', write('REPORT.md'), 'write REPORT.md'],
  ['ALLOW', write('tests/new.spec.js'), 'write tests/'],
  ['DENY', edit('package.json'), 'edit package.json'],
  ['DENY', edit('run.sh'), 'edit run.sh'],
  ['DENY', edit('CLAUDE.md'), 'edit CLAUDE.md'],
  ['DENY', edit('.claude/settings.json'), 'edit the hook config'],
  ['DENY', edit('.claude/hooks/guard.js'), 'edit the guard itself'],
  ['DENY', write(path.join(ROOT, 'firebase.json')), 'absolute path firebase.json'],
  ['ALLOW', { tool_name: 'Read', tool_input: { file_path: 'package.json' } }, 'reads are never blocked'],

  // shell writes
  ['DENY', bash('echo x > run.sh'), 'redirect to run.sh'],
  ['DENY', bash('cat a | tee .claude/settings.json'), 'tee to hook config'],
  ['DENY', bash('cp /tmp/x .claude/hooks/guard.js'), 'cp over the guard'],
  ['DENY', bash('mv /tmp/x package.json'), 'mv over package.json'],
  ['DENY', bash('node -e "require(\'fs\').writeFileSync(\'run.sh\',1)"'), 'node -e write'],
  ['ALLOW', bash('echo x > index.html'), 'redirect to index.html'],
  ['ALLOW', bash('npm run check 2>&1 | tail -20'), 'npm run check'],
  ['ALLOW', bash('node tests/gate.js > /dev/null'), 'redirect to /dev/null'],
  ['ALLOW', bash('cp index.html tests/fixture.html'), 'cp into tests/'],
  ['ALLOW', bash('node -e "console.log(1)"'), 'node -e without writes'],

  // unexpanded shell variables
  ['ALLOW', bash('cat REPORT.md >> "$BODY"'), 'append to $BODY (run.sh does this)'],
  ['ALLOW', bash('printf x > $BODY'), 'unquoted $BODY'],
  ['ALLOW', bash('printf x > ${BODY}'), 'braced ${BODY}'],
  ['DENY', bash('echo x > $PWD/run.sh'), 'variable with a literal path still checked'],
  ['DENY', bash('echo x > "$PWD/package.json"'), 'quoted variable with literal path']
];

var bad = 0;
cases.forEach(function (c) {
  var got = run(c[1]);
  var ok = got === c[0];
  if (!ok) bad++;
  console.log((ok ? '  ok   ' : '  FAIL ') + got.padEnd(6) +
    '(want ' + c[0] + ') ' + c[2]);
});

// --- smoke runner: a spawn that never ran is not an expected failure -------
//
// Not a guard case, but it belongs in this file for the same reason this file
// sits outside tests/: the loop may edit tests/, and this is the assertion
// that keeps the smoke gate honest. Commit d74fd38 fixed spawnSync('npx.cmd')
// failing with EINVAL on Windows. What made that bug expensive was not the
// failed spawn, it was that the failure read as "smoke XFAIL (expected)" and
// exited 0 -- so npm run check reported success without ever launching a
// browser, and the loop committed on the strength of a gate that never ran.
//
// A spawn that produced no exit status is not a test result. It must exit 1
// and must not claim XFAIL, whatever BACKLOG row 1 says.
var classify = require(path.join(ROOT, 'tests', 'smoke-run.js')).classify;

var smokeCases = [
  // want, spawnSync result, row 1 still open?, label
  [1, { error: new Error('spawn npx.cmd EINVAL'), status: null }, true,
    'spawn error, row 1 OPEN'],
  [1, { error: new Error('spawn npx.cmd EINVAL'), status: null }, false,
    'spawn error, row 1 DONE'],
  [1, { status: null, signal: 'SIGTERM' }, true,
    'killed by a signal, row 1 OPEN'],
  [1, { status: null, signal: null }, true,
    'null status with no error, row 1 OPEN'],
  [1, {}, true, 'undefined status, row 1 OPEN'],
  // Real runs are untouched: while row 1 is open a genuine failure is advisory.
  [0, { status: 1, signal: null }, true, 'real failing run is still XFAIL'],
  [0, { status: 0, signal: null }, true, 'real passing run is XPASS'],
  [0, { status: 0, signal: null }, false, 'real passing run, enforcing'],
  [1, { status: 1, signal: null }, false, 'real failing run, enforcing']
];

smokeCases.forEach(function (c) {
  var v = classify(c[1], c[2]);
  var ok = v.code === c[0];
  // The regression itself: a non-result reported as an expected failure.
  if (ok && c[0] === 1 && /XFAIL/.test(v.msg)) ok = false;
  if (!ok) bad++;
  console.log((ok ? '  ok   ' : '  FAIL ') + ('exit ' + v.code).padEnd(6) +
    '(want exit ' + c[0] + ') ' + c[3]);
});

var total = cases.length + smokeCases.length;
console.log('');
if (bad) {
  console.error(bad + ' of ' + total + ' cases wrong');
  process.exit(1);
}
console.log(total + ' cases passed (' + cases.length + ' guard, ' +
  smokeCases.length + ' smoke-runner)');
