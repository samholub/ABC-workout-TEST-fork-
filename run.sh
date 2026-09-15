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
cd "$ROOT"

N=${N:-5}
DATE=$(date +%Y-%m-%d)
BRANCH="auto/$DATE"
CHANNEL="${CHANNEL:-test}"
PROD_BRANCH="main"
LOCK="$ROOT/.loop.lock"

log() { printf '\n[loop %s] %s\n' "$(date +%H:%M:%S)" "$*"; }
die() { printf '\n[loop] FATAL: %s\n' "$*" >&2; exit 1; }

# --- preflight -------------------------------------------------------------
# Runs BEFORE the lock is taken: the lockfile lives in the repo root, so
# creating it first would make the dirty-tree check trip over the loop's own
# artifact every single time.
command -v claude >/dev/null 2>&1 || die "claude CLI not on PATH"
command -v node   >/dev/null 2>&1 || die "node not on PATH"

CURRENT=$(git rev-parse --abbrev-ref HEAD)
if [ "$CURRENT" = "$PROD_BRANCH" ]; then
  die "refusing to run from $PROD_BRANCH. Check out a working branch first."
fi
if [ -n "$(git status --porcelain)" ]; then
  die "working tree is dirty. Commit or stash before running the loop."
fi

# --- lock ------------------------------------------------------------------
if [ -e "$LOCK" ]; then
  die "another loop is running (or died holding $LOCK). Remove it to continue."
fi
echo "$$ started $(date)" > "$LOCK"
cleanup() { rm -f "$LOCK"; }
trap cleanup EXIT INT TERM

log "branch $BRANCH, up to $N row(s), preview channel '$CHANNEL'"

# --- worker instruction ----------------------------------------------------
# One row per session. The session is told the rules; the hook enforces them.
read_instruction() {
cat <<INSTRUCTION
Work exactly one row of the backlog in this repository.

1. Read CLAUDE.md first. It describes the app, the two deployed files, and the
   rules you are working under. Follow them.
2. Make sure you are on branch $BRANCH. Create it from the current branch if it
   does not exist (git checkout -b $BRANCH). Never check out, merge, push,
   reset or otherwise move main -- main is production.
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
while [ "$i" -le "$N" ]; do
  # Any OPEN rows left?
  if ! grep -qE '^\|[^|]*\|\s*OPEN\s*\|' BACKLOG.md; then
    log "no OPEN rows left, stopping after $worked row(s)"
    break
  fi

  log "row $i of $N"
  if read_instruction | claude -p --model sonnet --dangerously-skip-permissions; then
    worked=$((worked + 1))
    log "row $i done"
  else
    log "row $i failed -- the session marked the row BLOCKED and exited non-zero"
    break
  fi
  i=$((i + 1))
done

if [ "$worked" -eq 0 ]; then
  log "no rows completed, skipping review, deploy and PR"
  exit 1
fi

# --- review ----------------------------------------------------------------
log "reviewing $BRANCH against CLAUDE.md"
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
if [ -f .firebaserc ] && command -v firebase >/dev/null 2>&1; then
  log "deploying to preview channel '$CHANNEL'"
  DEPLOY_OUT=$(firebase hosting:channel:deploy "$CHANNEL" --expires 7d 2>&1) || true
  printf '%s\n' "$DEPLOY_OUT"
  PREVIEW_URL=$(printf '%s\n' "$DEPLOY_OUT" \
    | grep -oE 'https://[a-zA-Z0-9.-]*web\.app[^ ]*' | head -1)
  [ -n "$PREVIEW_URL" ] && log "preview: $PREVIEW_URL"
else
  log "no .firebaserc or no firebase CLI -- skipping preview deploy"
fi

# --- pull request ----------------------------------------------------------
log "pushing $BRANCH"
git push -u origin "$BRANCH"

BODY=$(mktemp)
if [ -n "$PREVIEW_URL" ]; then
  printf 'Preview: %s\n\n' "$PREVIEW_URL" >> "$BODY"
else
  printf 'Preview: _deploy skipped_\n\n' >> "$BODY"
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
log "done -- $worked row(s), PR open against main"
