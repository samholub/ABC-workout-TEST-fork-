# ABC Cycle Tracker — agent guide

## What this app is

A single-file React 18 PWA for tracking an A/B/C strength-training cycle. It
loads React from a CDN via UMD globals, uses `React.createElement` directly
(no JSX, no build step), and keeps every byte of user data in `localStorage`
(mirrored into IndexedDB as a backup) under the keys in `KEYS` — logs,
cycle state, last weights, video URLs, carry preference, rest duration and an
in-progress session draft. The script is organised into ten numbered sections:
core setup and storage (1), theme tokens (2), session/exercise/progression
config (3), pure analytics — e1RM, ACWR, PR detection, fatigue, deload (4),
pure recommendation helpers — progression engine, suggested load, smart warmup
(5), utilities (6), an experimental camera-PPG heart-rate engine (7), UI
components (8), the single `App` component with all screen renderers and the
router (9), and the error boundary plus mount (10). Screens flow
home → readiness check-in → workout → complete, with history, dashboard,
PR board and settings reachable from home. Sections 4 and 5 are pure
functions over a `logs` array and are the only parts covered by unit tests.

**Log ordering is newest-first**: `logs[0]` is the most recent session.
Every helper that slices history (`getGhostSets`, `getProgression`,
`shouldDeload`, `getFatigueTrend`) assumes this. `getExE1RM` and `getExHistory`
iterate the array backwards and re-`reverse()`, so they also return
newest-first — read index 0, not the last element.

## The two deployed files

- `index.html` — the entire application.
- `sw.js` — the service worker: cache-first for assets, network-first for
  navigations. A navigation goes to the network, stores the response in the
  cache when it is `ok`, and reads the cache only if the fetch throws —
  falling back to the cached page, or a 503 if there is none. A deploy is
  therefore live on the next open rather than the one after it.

Nothing else ships. `manifest` and icons are inlined as data URIs in
`index.html`.

## `reference/`

History and rationale, not instructions or current state. The loop does not
read this folder.

## Deploy fact

`main` is production. GitHub Pages serves it, so **any commit pushed to `main`
is live on the user's phone within about a minute.** There is no staging step
and no build. Treat `main` as untouchable.

## Data-loss tokens

These identifiers read or destroy the user's only copy of their training
history. Any diff that touches one needs an explicit note in `REPORT.md`
saying what changed and how to verify it on a phone:

- `S.set(KEYS.logs, ...)` — overwrites the entire log array.
- `clearDraft` — deletes the in-progress session draft.
- `clearAll` — wipes logs, state, weights and videos.
- `saveAndFinish` — the only path that writes a completed session.
- `applyImport` — replaces all data with an imported file.
- `validateLogs` — silently drops log entries that fail its shape check.

## Loop rules

1. **Never write to `main`.** Work happens on `auto/<date>` branches; `main`
   only changes through a reviewed pull request that the user merges.
   `run.sh` cuts `auto/<date>` from `main` itself, after checking that local
   `main` matches `origin/main`, and starting the loop from `main` is the
   normal case. A worker session is already on that branch when it starts and
   must not create, switch or delete branches. `run.sh` refuses to start only
   when `auto/<date>` already exists carrying commits that are not on `main` —
   that is a previous run's work, and it needs merging or deleting first.
2. **One backlog row per commit.** Take the top `OPEN` row in `BACKLOG.md`,
   fix exactly that, and stop. No feature work, no drive-by refactors, no
   reformatting of untouched lines.
3. **`npm run check` must pass before committing.** It runs `gate` (syntax
   and encoding), `test` (unit fixtures) and `smoke` (Playwright). On
   failure: `git checkout -- .`, mark the row `BLOCKED` with the reason,
   and exit non-zero. Do not "fix" a failing check by weakening the test.
4. **Only these paths are writable**: `index.html`, `sw.js`, `BACKLOG.md`,
   `REPORT.md`, `tests/`. A `PreToolUse` hook in `.claude/settings.json`
   enforces this, along with denying any branch-moving git command that names
   `main`, `git reset --hard`, `rm -rf`, and unscoped `firebase deploy`.
   The harness files themselves — `run.sh`, `sup.sh`, `.claude/`,
   `.gitignore`, `.gitattributes`, `package.json`, `firebase.json`,
   `CLAUDE.md` — are edited **only in a supervised session with the hook
   parked**, which is what `sh sup.sh` sets up: it refuses unless `main` is
   checked out clean, parks the hook, runs an interactive Claude in the repo
   root, restores the hook on every exit path, and exits non-zero if
   `.claude/` no longer matches `main`. The loop never edits its own
   boundary.
5. **Do not restructure `index.html` to make testing easier.** The test
   harness slices the inline script by its section-header comments
   (`// 4.`, `// 6.`); keep those headers intact and keep sections 4 and 5
   free of DOM and React references.
6. **Preserve newest-first log ordering** in anything that writes `KEYS.logs`.
7. When a change touches a data-loss token, say so in the commit body.

## Decision block

When a row is ambiguous, work through these in order. They bind tighter than
anything the session prompt says.

1. **Ship the smallest change that fixes the row.** The row names a defect;
   the fix is the least code that makes that defect stop happening. A larger
   change that is also correct is still the wrong change.
2. **Do not refactor past the row's lines.** Touch the lines the row is
   about. Adjacent code that is ugly, duplicated, or wrong in some other
   way is a different row, not part of this one — leave it as it is. The
   review session already collects anything that belongs in `BACKLOG.md`
   and is not there yet. Renaming, reordering, extracting helpers and
   reformatting all count as refactoring.
3. **If the fix needs a choice the user would notice and `npm run check`
   cannot check, do not guess.** Mark the row `BLOCKED` and put one line in
   the Title column: the question, phrased so it can be answered yes/no or
   with a single value. Then stop. A guessed answer that passes the gate is
   worse than a blocked row, because it ships as though it were decided.

A choice is user-noticeable when it changes what appears on screen, what is
stored, what is thrown away, or what the app does without asking — copy,
defaults, thresholds, ordering, how many items are shown, which of two
plausible behaviours a control gets. The gate checks syntax, the pure
analytics fixtures and one smoke journey; it has no opinion about any of
these.
