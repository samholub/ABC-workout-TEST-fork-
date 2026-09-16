#!/bin/sh
# Unattended improvement loop for the ABC Cycle Tracker.
#
#   sh run.sh          work up to 5 backlog rows
#   N=1 sh run.sh      work one row
#
# Written for Git Bash on Windows (POSIX sh, no bashisms).
#
# What it does:
#   1. Takes a lock so two loops never run at once.
#   2. For each of N iterations, launches a headless Claude session that works
#      the top OPEN row of BACKLOG.md on branch auto/<date>, runs npm run check,
#      and commits on pass or marks the row BLOCKED and exits non-zero on fail.
#   3. Afterwards, a review session diffs main...auto/<date> against CLAUDE.md
#      and writes REPORT.md.
#   4. Deploys the branch to a Firebase preview channel.
#   5. Opens a pull request against main with REPORT.md as the body.
#
# main is never written to. The PreToolUse hook in .claude/settings.json is the
# safety boundary for the worker sessions -- they run with
# --dangerously-skip-permissions, and the hook is what stops them touching
# main, resetting hard, rm -rf'ing, deploying to live, or editing anything
# outside index.html, sw.js, BACKLOG.md, REPORT.md and tests/.

set -e

ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT" || exit 1

# Every claude -p in this script is preceded by "cd $ROOT". A session inherits
# the loop's working directory, and it decides which repo it edits, which
# .claude/settings.json hook guards it and whether ./BACKLOG.md resolves at
# all. run.sh cds once at the top and nothing here changes directory, so the
# repeats are redundant today -- they are there so that adding a step that
# does cd cannot silently launch a session somewhere else.

N=${N:-5}
DATE=$(date +%Y-%m-%d)
BRANCH="auto/$DATE"
CHANNEL="${CHANNEL:-test}"
PROD_BRANCH="main"
LOCK="$ROOT/.loop.lock"
# Session transcripts live OUTSIDE the repo on purpose: the preflight
# dirty-tree check and the worker sessions' own commits must not see them,
# and .gitignore is not ours to edit from the loop.
LOGDIR="$(cd "$ROOT/.." && pwd)/abc-loop-logs/$DATE"

log() { printf '\n[loop %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\n[loop] FATAL: %s\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------------
# Runs BEFORE the lock is taken: the lockfile lives in the repo root, so
# creating it first would make the dirty-tree check trip over the loop's own
# artifact every single time.
command -v claude >/dev/null 2>&1 || die "claude CLI not on PATH"
command -v node   >/dev/null 2>&1 || die "node not on PATH"

if [ -n "$(git status --porcelain)" ]; then
  die "working tree is dirty. Commit or stash before running the loop."
fi

# main is the base for both the working branch and the pull request. If the
# local copy has drifted from the remote, every row is worked against a stale
# base and the PR diff describes code that main does not actually hold.
log "checking $PROD_BRANCH against origin"
git fetch origin --quiet \
  || die "git fetch origin failed -- cannot verify $PROD_BRANCH is current"
LOCAL_MAIN=$(git rev-parse --verify --quiet "$PROD_BRANCH") \
  || die "no local $PROD_BRANCH branch to check"
REMOTE_MAIN=$(git rev-parse --verify --quiet "origin/$PROD_BRANCH") \
  || die "no origin/$PROD_BRANCH -- is the remote configured?"
if [ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]; then
  die "local $PROD_BRANCH is $LOCAL_MAIN but origin/$PROD_BRANCH is $REMOTE_MAIN.
Fast-forward $PROD_BRANCH first; the loop will not build on a stale base."
fi

# --- lock ------------------------------------------------------------------
if [ -e "$LOCK" ]; then
  die "another loop is running (or died holding $LOCK). Remove it to continue."
fi
echo "$$ started $(date)" > "$LOCK"

# Drop the lock and hand the repo back on main, on every exit path.
#
# The next run's preflight refuses a dirty tree and compares local main to
# origin/main, then cuts $BRANCH from main. A run that died mid-row used to
# leave $BRANCH checked out, so the next one started from a branch that
# already carried commits -- which the branch check reads as "a previous
# run's work" and refuses. Returning to main means the normal starting state
# is restored whether the run succeeded or failed.
#
# The exit status is captured first and re-raised last: nothing in here may
# turn a failed run into a successful one, or the reverse.
cleanup() {
  CLEAN_STATUS=$?
  trap - EXIT INT TERM
  rm -f "$LOCK"
  CUR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')
  if [ -n "$CUR" ] && [ "$CUR" != "$PROD_BRANCH" ]; then
    if git checkout --quiet "$PROD_BRANCH" 2>/dev/null; then
      printf '\n[loop] returned to %s\n' "$PROD_BRANCH"
    else
      # Uncommitted changes from a session that died mid-edit. Say so rather
      # than discarding them -- the next run will refuse on the dirty tree.
      printf '\n[loop] WARNING: could not return to %s from %s.\n' \
        "$PROD_BRANCH" "$CUR" >&2
      printf '[loop] Commit or discard the work there, then: git checkout %s\n' \
        "$PROD_BRANCH" >&2
    fi
  fi
  exit "$CLEAN_STATUS"
}
trap cleanup EXIT INT TERM

# --- working branch --------------------------------------------------------
# The loop owns its branch. Being on main is the normal starting state, not an
# error: main is the base, so the loop cuts $BRANCH from it and works there.
# (It previously refused to start from main and left branch creation to the
# worker session, which meant the branch was cut from whatever happened to be
# checked out.)
#
# The one thing worth refusing is an existing $BRANCH that already carries
# commits main does not have: that is a previous run's work, and continuing on
# top of it would fold two runs into one pull request.
if git rev-parse --verify --quiet "refs/heads/$BRANCH" >/dev/null; then
  EXISTING=$(git rev-list --count "$PROD_BRANCH..$BRANCH")
  if [ "$EXISTING" -gt 0 ]; then
    die "$BRANCH already exists with $EXISTING commit(s) not on $PROD_BRANCH.
Merge or delete it before starting another run."
  fi
  # Zero commits ahead, so nothing of its own is lost by re-pointing it at
  # main -- which also stops a leftover branch from yesterday being worked
  # against a stale base.
  log "reusing existing empty $BRANCH, re-cut from $PROD_BRANCH"
  git checkout --quiet -B "$BRANCH" "$PROD_BRANCH" \
    || die "could not re-cut $BRANCH from $PROD_BRANCH"
else
  log "creating $BRANCH from $PROD_BRANCH"
  git checkout --quiet -b "$BRANCH" "$PROD_BRANCH" \
    || die "could not create $BRANCH from $PROD_BRANCH"
fi

mkdir -p "$LOGDIR" || die "cannot create log directory $LOGDIR"

log "branch $BRANCH, up to $N row(s), preview channel '$CHANNEL'"
log "session logs: $LOGDIR"

# --- worker instruction ----------------------------------------------------
# One row per session. The session is told the rules; the hook enforces them.
read_instruction() {
cat <<INSTRUCTION
Work exactly one row of the backlog in this repository.

1. Read CLAUDE.md first. It describes the app, the two deployed files, and the
   rules you are working under. Follow them.
2. You are already on branch $BRANCH, cut from main by the loop. Stay on it: do
   not create, switch, merge, rebase or delete branches. Never check out, merge,
   push, reset or otherwise move main -- main is production.
3. Open BACKLOG.md and take the TOPMOST row whose status is OPEN. That row is
   your entire scope. Do not touch any other row, and do not add features.
4. Fix it in index.html, sw.js or tests/ only.
5. Run: npm run check
   - If it PASSES: commit with the message "W<n>: <row title>", where <n> is the
     row number and <row title> is a short version of the row's title. Then edit
     BACKLOG.md to set that row's status to DONE and put the new commit hash in
     the Commit column, and amend or make a follow-up commit so the backlog
     edit is recorded.
   - If it FAILS: run "git checkout -- ." to revert your changes, edit
     BACKLOG.md to set that row's status to BLOCKED with a one-line reason in
     the Title column, commit only the BACKLOG.md change, and exit with a
     non-zero status.
6. Stop after one row. Do not start the next one.
INSTRUCTION
}

# --- the loop --------------------------------------------------------------
i=1
worked=0
blocked_stop=0
# grep -c prints 0 and exits 1 when nothing matches, so "|| true" keeps set -e
# out of it; the ${n:-0} covers BACKLOG.md having gone missing entirely.
count_blocked() {
  n=$(grep -cE '^\|[^|]*\|\s*BLOCKED\s*\|' BACKLOG.md 2>/dev/null || true)
  printf '%s' "${n:-0}"
}
while [ "$i" -le "$N" ]; do
  # Any OPEN rows left?
  if ! grep -qE '^\|[^|]*\|\s*OPEN\s*\|' BACKLOG.md; then
    log "no OPEN rows left, stopping after $worked row(s)"
    break
  fi

  cd "$ROOT" || die "cannot cd to $ROOT"
  ROWLOG="$LOGDIR/row-$i.log"
  HEAD_BEFORE=$(git rev-parse HEAD)
  BLOCKED_BEFORE=$(count_blocked)
  log "row $i of $N -- log: $ROWLOG"
  # Both streams go to the log, then the log is echoed back. Without this the
  # only trace of a session that died on launch is a blank gap in the console.
  if read_instruction | claude -p --model sonnet --dangerously-skip-permissions \
       >"$ROWLOG" 2>&1; then
    STATUS=0
  else
    STATUS=$?
  fi
  cat "$ROWLOG"

  # Two failure shapes have to be told apart here.
  #
  # A LAUNCH failure -- the session never ran, or died before working the row
  # -- is a hard stop: the run does not advance, review, deploy or push. Two
  # signals catch it, and they are checked first because a session that never
  # started cannot have decided anything:
  #
  #   1. the transcript carries one of the CLI's own failure banners. "claude
  #      -p" can print "Execution error" and still exit 0, which is how an
  #      earlier run marked five dead sessions as done.
  #   2. HEAD did not move. A session that ran but committed nothing has not
  #      fixed a row, whatever it said.
  #
  # A BLOCKED row is the opposite: the worker ran, judged the row unfixable or
  # ambiguous, recorded that judgement in BACKLOG.md, committed it and exited
  # non-zero on purpose. That stops the LOOP -- no further rows, since the next
  # one may depend on this -- but it does not abort the RUN. Rows that already
  # passed are finished work and still deserve their review, preview and PR.
  if grep -qiE '^[[:space:]]*(Execution error|Error: |API Error|Invalid API key|Credit balance)' "$ROWLOG"; then
    die "row $i: session reported a launch/execution error and never worked the row.
Log: $ROWLOG"
  fi
  HEAD_AFTER=$(git rev-parse HEAD)
  if [ "$HEAD_AFTER" = "$HEAD_BEFORE" ]; then
    die "row $i: session exited $STATUS and committed nothing (HEAD still $HEAD_BEFORE).
Log: $ROWLOG"
  fi

  if [ "$STATUS" -ne 0 ]; then
    BLOCKED_AFTER=$(count_blocked)
    if [ "$BLOCKED_AFTER" -gt "$BLOCKED_BEFORE" ]; then
      log "row $i: worker marked a row BLOCKED and stopped by design (exit $STATUS).
Not counted as a worked row. Log: $ROWLOG"
      blocked_stop=1
      break
    fi
    # Non-zero, HEAD moved, but no new BLOCKED row: the session failed in some
    # way it did not record. Nothing here knows what state it left behind.
    die "row $i: session exited $STATUS without marking a row BLOCKED.
Its commit(s) are on $BRANCH but unexplained. Log: $ROWLOG"
  fi

  worked=$((worked + 1))
  log "row $i done ($(git rev-parse --short HEAD))"
  i=$((i + 1))
done

if [ "$worked" -eq 0 ]; then
  if [ "$blocked_stop" -eq 1 ]; then
    die "the first row was marked BLOCKED, so nothing passed -- skipping review,
deploy and PR. The BLOCKED row is committed on $BRANCH; read it, decide, and
run again. Logs: $LOGDIR"
  fi
  die "no rows completed -- skipping review, deploy and PR. Logs: $LOGDIR"
fi

if [ "$blocked_stop" -eq 1 ]; then
  log "continuing with the $worked row(s) that passed before the BLOCKED row"
fi

# Belt and braces: even with a non-zero $worked, never take an empty branch
# any further. A pushed branch with no commits makes a PR with an empty diff.
AHEAD=$(git rev-list --count "$PROD_BRANCH..$BRANCH")
if [ "$AHEAD" -eq 0 ]; then
  die "$BRANCH has no commits ahead of $PROD_BRANCH -- refusing to review, deploy
or push an empty branch. Logs: $LOGDIR"
fi

# --- review ----------------------------------------------------------------
log "reviewing $BRANCH against CLAUDE.md"
cd "$ROOT" || die "cannot cd to $ROOT"
claude -p --model opus --dangerously-skip-permissions <<REVIEW
Review the work on branch $BRANCH and write REPORT.md.

Run "git diff main...$BRANCH" and read CLAUDE.md. For each backlog row that was
completed on this branch, write a section containing:

  * What changed, in plain language -- what the user will see differently.
  * Which data-loss tokens the diff touches (S.set(KEYS.logs), clearDraft,
    clearAll, saveAndFinish, applyImport, validateLogs), or "none". If any are
    touched, say exactly what changed about them and what could go wrong.
  * Phone steps: the numbered taps to verify the fix on a phone, starting from
    a cold open of the app.

Then a short section listing anything in the diff that worries you, and
anything you think belongs in BACKLOG.md that is not there yet.

Write the result to REPORT.md. Do not change any other file.
REVIEW

[ -f REPORT.md ] || die "review session did not produce REPORT.md"

# --- preview deploy --------------------------------------------------------
PREVIEW_URL=""
[ -f .firebaserc ] || die "no .firebaserc -- cannot deploy a preview, and a PR
without one asks the user to review a change they cannot open. Stopping before
push and PR."
command -v firebase >/dev/null 2>&1 || die "firebase CLI not on PATH -- cannot
deploy a preview. Stopping before push and PR."

log "deploying to preview channel '$CHANNEL'"
DEPLOY_OUT=$(firebase hosting:channel:deploy "$CHANNEL" --expires 7d 2>&1) || true
# A channel deploy prints two URLs: the live hosting site and the preview
# channel just created. The live URL is main, not this branch -- putting it
# in the PR body would show a reviewer production and call it the preview.
# The channel URL is the one whose host carries "--<channel>-", so match
# that literally instead of taking the first *.web.app on the page.
# The "|| true" matters: under "set -e" a no-match grep would abort the script
# here, silently, before the check below could print the firebase output.
PREVIEW_URL=$(printf '%s\n' "$DEPLOY_OUT" \
  | grep -oE "https://[a-zA-Z0-9.-]+--${CHANNEL}-[a-zA-Z0-9.-]+\.web\.app[^ ]*" \
  | head -1) || true

# No channel URL means the deploy did not happen, whatever its exit status.
# There is nothing to review against, so the run stops here -- before the push
# and before the PR -- and prints what firebase actually said.
if [ -z "$PREVIEW_URL" ]; then
  printf '\n[loop] firebase output:\n%s\n\n' "$DEPLOY_OUT" >&2
  die "no URL matching '--$CHANNEL-' in the deploy output (above). The preview
deploy failed, so $BRANCH has NOT been pushed and no pull request was opened.
Row work is committed locally on $BRANCH. Logs: $LOGDIR"
fi
log "preview: $PREVIEW_URL"

# --- pull request ----------------------------------------------------------
log "pushing $BRANCH"
git push -u origin "$BRANCH"

BODY=$(mktemp)
printf 'Preview: %s\n\n' "$PREVIEW_URL" >> "$BODY"
if [ "$blocked_stop" -eq 1 ]; then
  printf '> **The run stopped early.** A worker marked a backlog row `BLOCKED`
> rather than guessing, so the rows below it were not attempted. The reason is
> in the `BACKLOG.md` diff; it needs an answer before the next run.\n\n' >> "$BODY"
fi
cat REPORT.md >> "$BODY"
printf '\n---\n🤖 Generated with [Claude Code](https://claude.com/claude-code)\n' >> "$BODY"

log "opening pull request"
gh pr create \
  --base main \
  --head "$BRANCH" \
  --title "Automated fixes: $DATE ($worked row(s))" \
  --body-file "$BODY"

rm -f "$BODY"
if [ "$blocked_stop" -eq 1 ]; then
  log "done -- $worked row(s), PR open against main.
A row is BLOCKED and needs an answer before the next run: see BACKLOG.md."
else
  log "done -- $worked row(s), PR open against main"
fi
