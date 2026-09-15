// PreToolUse guard. This is the safety boundary for the unattended loop
// sessions launched by run.sh with --dangerously-skip-permissions.
//
// It denies, regardless of what the session was told to do:
//   * any branch-moving git command naming main (checkout, switch, merge,
//     push, reset, branch, rebase, cherry-pick) -- main is production
//   * git reset --hard
//   * rm -rf
//   * firebase deploy that is not scoped to hosting AND a preview channel
//   * edits to anything outside index.html, sw.js, BACKLOG.md, REPORT.md
//     and tests/ -- whether through the edit tools, a shell redirect, tee,
//     sed -i, mv, cp, or an inline `node -e` that writes files
//
// Reading is never blocked. Only writes and the listed commands are.
//
// The git checks are parsed per command, not grepped over the whole string:
// the subcommand is resolved first and the check applies only to ITS
// arguments. Otherwise `git commit -m "...do not push to main..."` is refused
// for talking about the rule it is obeying.
'use strict';
var path = require('path');

var ROOT = process.cwd();
var ALLOWED_FILES = ['index.html', 'sw.js', 'BACKLOG.md', 'REPORT.md'];
var ALLOWED_DIRS = ['tests'];
var PROTECTED_BRANCH = 'main';
var MOVING = ['checkout', 'switch', 'merge', 'push', 'reset', 'branch',
  'rebase', 'cherry-pick'];
// git options that take a separate value, so the value is not the subcommand.
var GIT_OPTS_WITH_VALUE = ['-C', '-c', '--git-dir', '--work-tree', '--namespace',
  '--exec-path', '--config-env'];

function deny(reason) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'deny',
      permissionDecisionReason: reason
    }
  }));
  process.exit(0);
}
function allow() { process.exit(0); }

var SCOPE = 'The loop may only edit index.html, sw.js, BACKLOG.md, REPORT.md ' +
  'and tests/.';

function writable(p) {
  if (!p) return true;
  var abs;
  try { abs = path.resolve(ROOT, p); } catch (e) { return true; }
  var rel = path.relative(ROOT, abs);
  // Outside the repo (temp dirs, scratchpad) is not our business.
  if (rel.startsWith('..') || path.isAbsolute(rel)) return true;
  rel = rel.split(path.sep).join('/');
  if (rel === '') return false;
  if (ALLOWED_FILES.indexOf(rel) !== -1) return true;
  return ALLOWED_DIRS.some(function (d) {
    return rel === d || rel.startsWith(d + '/');
  });
}

function unquote(s) { return s.replace(/^["']|["']$/g, ''); }

function isGit(tok) {
  var t = unquote(tok).replace(/\\/g, '/');
  return t === 'git' || t === 'git.exe' || /\/git(\.exe)?$/.test(t);
}

// Does any argument name the protected branch as a ref?
function namesProtected(args) {
  return args.some(function (a) {
    var t = unquote(a);
    // main, origin/main, HEAD:main, main~2, refs/heads/main, main...x
    return t.split(/[:/~^]|\.\.\.?/).indexOf(PROTECTED_BRANCH) !== -1;
  });
}

function checkGitSegment(tokens) {
  for (var i = 0; i < tokens.length; i++) {
    if (!isGit(tokens[i])) continue;
    var j = i + 1;
    while (j < tokens.length) {
      var t = tokens[j];
      if (GIT_OPTS_WITH_VALUE.indexOf(t) !== -1) { j += 2; continue; }
      if (t.charAt(0) === '-') { j++; continue; }
      break;
    }
    if (j >= tokens.length) return;
    var sub = unquote(tokens[j]);
    var args = tokens.slice(j + 1);

    if (sub === 'reset' && args.some(function (a) { return a === '--hard'; })) {
      deny('Blocked: git reset --hard destroys uncommitted work. Use ' +
        '"git checkout -- ." to revert a failed row.');
    }
    if (MOVING.indexOf(sub) !== -1 && namesProtected(args)) {
      deny('Blocked: ' + PROTECTED_BRANCH + ' is production (GitHub Pages ' +
        'deploys it). "git ' + sub + '" here names ' + PROTECTED_BRANCH +
        '. Work on auto/<date> and let a pull request reach it.');
    }
    return; // only the first git invocation in a segment is executed
  }
}

var raw = '';
process.stdin.on('data', function (c) { raw += c; });
process.stdin.on('end', function () {
  var input;
  try { input = JSON.parse(raw); } catch (e) { allow(); }
  var tool = input.tool_name || '';
  var args = input.tool_input || {};

  // --- file-editing tools ------------------------------------------------
  if (['Edit', 'Write', 'MultiEdit', 'NotebookEdit'].indexOf(tool) !== -1) {
    var f = args.file_path || args.notebook_path;
    if (!writable(f)) deny('Blocked: ' + SCOPE + ' Refused write to "' + f + '".');
    allow();
  }
  if (tool !== 'Bash' && tool !== 'PowerShell') allow();

  var flat = String(args.command || '').replace(/\s+/g, ' ');

  // --- git, parsed per command segment ------------------------------------
  flat.split(/[;|&]+/).forEach(function (seg) {
    var tokens = seg.trim().match(/"[^"]*"|'[^']*'|[^\s]+/g) || [];
    checkGitSegment(tokens);
  });

  // --- rm -rf ---------------------------------------------------------------
  if (/\brm\b\s+(?:-[a-zA-Z]+\s+)*-[a-zA-Z]*(?:rf|fr)[a-zA-Z]*\b/.test(flat) ||
      /\brm\b[^|;&]*\s--recursive\b[^|;&]*\s--force\b/.test(flat)) {
    deny('Blocked: rm -rf. If a generated directory needs clearing, name the ' +
      'paths explicitly.');
  }

  // --- firebase -------------------------------------------------------------
  var isChannelDeploy = /\bfirebase\b[^|;&]*\bhosting:channel:deploy\b/.test(flat);
  if (!isChannelDeploy && /\bfirebase\b[^|;&]*\bdeploy\b/.test(flat)) {
    var scoped = /--only\s+hosting\b/.test(flat);
    var preview = /--channel\b|hosting:channel/.test(flat);
    if (!scoped || !preview) {
      deny('Blocked: firebase deploy must be scoped to hosting AND target a ' +
        'preview channel. Use "firebase hosting:channel:deploy <channel>" or ' +
        'add --only hosting --channel <name>. A bare deploy publishes to live.');
    }
  }

  // --- inline node scripts that write files ---------------------------------
  if (/\bnode\b[^|;&]*\s-(?:e|p|-eval|-print)\b/.test(flat) &&
      /writeFile|appendFile|createWriteStream|renameSync|rename\(|copyFile|rmSync|unlinkSync|mkdirSync|openSync/.test(flat)) {
    deny('Blocked: inline "node -e" that writes to the filesystem. ' + SCOPE +
      ' Use the edit tools on an allowed path so the scope check applies.');
  }

  // --- shell writes to non-allowlisted paths --------------------------------
  var targets = [];
  var m;
  var reRedirect = /(?:^|[^0-9>])>>?\s*("[^"]+"|'[^']+'|[^\s;|&]+)/g;
  while ((m = reRedirect.exec(flat)) !== null) targets.push(m[1]);
  var reTee = /\btee\b\s+(?:-a\s+)?("[^"]+"|'[^']+'|[^\s;|&]+)/g;
  while ((m = reTee.exec(flat)) !== null) targets.push(m[1]);
  var reSed = /\bsed\b[^|;&]*\s-i[^\s]*\s[^|;&]*?("[^"]+"|'[^']+'|[^\s;|&]+)\s*(?:$|[;|&])/g;
  while ((m = reSed.exec(flat)) !== null) targets.push(m[1]);
  var reMove = /\b(?:mv|cp|install)\b((?:\s+(?:-[^\s]+|"[^"]+"|'[^']+'|[^\s;|&]+))+)/g;
  while ((m = reMove.exec(flat)) !== null) {
    var parts = m[1].trim().split(/\s+/).filter(function (a) {
      return a.charAt(0) !== '-';
    });
    if (parts.length >= 2) targets.push(parts[parts.length - 1]);
  }

  for (var i = 0; i < targets.length; i++) {
    var t = unquote(targets[i]);
    if (t === '/dev/null' || t === 'NUL' || t.charAt(0) === '&' || t === '') continue;
    if (!writable(t)) deny('Blocked: shell write to "' + t + '". ' + SCOPE);
  }

  allow();
});
