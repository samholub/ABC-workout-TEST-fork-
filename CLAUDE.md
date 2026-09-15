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
- `sw.js` — the service worker (cache-first for assets, network-first for
  navigations).

Nothing else ships. `manifest` and icons are inlined as data URIs in
`index.html`.

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
2. **One backlog row per commit.** Take the top `OPEN` row in `BACKLOG.md`,
   fix exactly that, and stop. No feature work, no drive-by refactors, no
   reformatting of untouched lines.
3. **`npm run check` must pass before committing.** It runs `gate` (syntax
   and encoding), `test` (unit fixtures) and `smoke` (Playwright). On
   failure: `git checkout -- .`, mark the row `BLOCKED` with the reason,
   and exit non-zero. Do not "fix" a failing check by weakening the test.
4. **Only these paths are writable**: `index.html`, `sw.js`, `BACKLOG.md`,
   `REPORT.md`, `tests/`. A `PreToolUse` hook in `.claude/settings.json`
   enforces this, along with denying any git command that names `main`,
   `git reset --hard`, `rm -rf`, and unscoped `firebase deploy`.
5. **Do not restructure `index.html` to make testing easier.** The test
   harness slices the inline script by its section-header comments
   (`// 4.`, `// 6.`); keep those headers intact and keep sections 4 and 5
   free of DOM and React references.
6. **Preserve newest-first log ordering** in anything that writes `KEYS.logs`.
7. When a change touches a data-loss token, say so in the commit body.
