#!/bin/sh
# Supervised harness session for the ABC Cycle Tracker.
#
#   sh sup.sh
#
# Written for Git Bash on Windows (POSIX sh, no bashisms).
#
# The loop's worker sessions cannot edit the harness: the PreToolUse hook in
# .claude/settings.json refuses any write outside index.html, sw.js,
# BACKLOG.md, REPORT.md and tests/. That is deliberate -- an unattended session
# running with --dangerously-skip-permissions must not be able to edit the
# thing that is guarding it.
#
# So changing run.sh, sup.sh, CLAUDE.md, .claude/, package.json, firebase.json,
# .gitignore or .gitattributes happens here instead: this script parks the
# hook, hands you an interactive Claude on main, and puts the hook back
# afterwards -- on every exit path, including Ctrl-C.
#
# The session is interactive on purpose. Nothing that can edit the guard runs
# unattended.

set -e

ROOT=$(cd "$(dirname "$0")" && pwd)
cd "$ROOT" || exit 1

PROD_BRANCH="main"
SETTINGS="$ROOT/.claude/settings.json"
PARKED="$SETTINGS.off"

log() { printf '\n[sup] %s\n' "$*"; }
die() { printf '\n[sup] FATAL: %s\n' "$*" >&2; exit 1; }

# --- recover a parked hook ---------------------------------------------------
# Closing the terminal window with the X kills this script without running the
# EXIT trap, leaving the hook parked. If only the parked copy exists, put it
# back before anything else runs. (Both present is still refused below.)
if [ -e "$PARKED" ] && [ ! -e "$SETTINGS" ]; then
  mv "$PARKED" "$SETTINGS" || die "could not restore the parked hook:
  mv \"$PARKED\" \"$SETTINGS\""
  log "found a parked hook from a session that did not exit cleanly -- restored it"
fi

# --- preflight -------------------------------------------------------------
# All of this runs BEFORE the hook is parked. There is no window in which the
# guard is off and the repo is in a state nobody checked.
command -v claude >/dev/null 2>&1 || die "claude CLI not on PATH"

git rev-parse --git-dir >/dev/null 2>&1 || die "not a git repository"

CUR=$(git rev-parse --abbrev-ref HEAD 2>/dev/null) \
  || die "cannot read the current branch (detached HEAD?)"
if [ "$CUR" != "$PROD_BRANCH" ]; then
  die "on '$CUR', not $PROD_BRANCH. A supervised session starts from
$PROD_BRANCH so it can cut its own harness/<topic> branch, and so the .claude/
comparison on the way out has a meaningful base. Check out $PROD_BRANCH first."
fi

if [ -n "$(git status --porcelain)" ]; then
  die "working tree is dirty. Commit or stash first -- the hook must never be
parked on top of work nobody has looked at."
fi

[ -f "$SETTINGS" ] || die "no $SETTINGS to park. The hook is already off, or
this is not the repository root. Restore it before starting a session."

if [ -e "$PARKED" ]; then
  die "$PARKED already exists. A previous supervised session did not restore
the hook. Inspect both files and move it back by hand before continuing."
fi

# --- restore ---------------------------------------------------------------
# Two jobs, in this order: put the hook back, then check that the session did
# not change the guard behind it. The second is the point of the script. While
# the hook was parked the session could edit .claude/ freely, and a change
# there is a change to the safety boundary that every unattended run sits
# behind -- it must not leave this script quietly.
restore() {
  SUP_STATUS=$?
  trap - EXIT INT TERM

  if [ -e "$PARKED" ]; then
    if mv "$PARKED" "$SETTINGS"; then
      log "hook restored"
    else
      printf '\n[sup] FATAL: could not restore the hook. Run this by hand,
now, before any unattended loop:\n  mv "%s" "%s"\n' "$PARKED" "$SETTINGS" >&2
      exit 1
    fi
  fi

  # Tracked changes, staged or not, committed or not: anything that makes the
  # working tree's .claude/ differ from main.
  GUARD_DIFF=0
  git diff --quiet "$PROD_BRANCH" -- .claude/ 2>/dev/null || GUARD_DIFF=1
  # ...and files the session added that git is not tracking yet, which no diff
  # against main would show.
  GUARD_NEW=$(git ls-files --others --exclude-standard -- .claude/ 2>/dev/null)

  if [ "$GUARD_DIFF" -ne 0 ] || [ -n "$GUARD_NEW" ]; then
    printf '\n[sup] .claude/ DIFFERS FROM %s\n\n' "$PROD_BRANCH" >&2
    if [ "$GUARD_DIFF" -ne 0 ]; then
      git --no-pager diff --stat "$PROD_BRANCH" -- .claude/ >&2
    fi
    if [ -n "$GUARD_NEW" ]; then
      printf '\nuntracked in .claude/:\n%s\n' "$GUARD_NEW" >&2
    fi
    printf '\n[sup] The session changed the guard. Every unattended run hides
behind that file, so read the diff yourself before it reaches %s. If the
change was not intended: git checkout %s -- .claude/\n' \
      "$PROD_BRANCH" "$PROD_BRANCH" >&2
    exit 1
  fi

  log "guard unchanged against $PROD_BRANCH"
  exit "$SUP_STATUS"
}
trap restore EXIT INT TERM

# --- park and run ----------------------------------------------------------
mv "$SETTINGS" "$PARKED" || die "could not park the hook"
log "hook parked at $PARKED"
log "harness files are writable in this session -- branch before you commit"
log "starting claude in $ROOT"

# A non-zero exit from the session is not this script's failure: the user
# quitting with an error, or Ctrl-C, still has to reach restore() below.
claude --model opus || true

# restore() runs from the EXIT trap and has the last word.
