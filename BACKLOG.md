# BACKLOG

One row per commit. The loop takes the top `OPEN` row, fixes exactly that,
runs `npm run check`, and marks the row `DONE` with the commit hash. On a
failing check the row is marked `BLOCKED` with the reason and the working
tree is reverted.

Status is one of `OPEN`, `DONE`, `BLOCKED`. No feature rows — this list is
defects only.

Rows are worked in the order they appear, not by number: the top `OPEN` row
is next. The `#` is a stable id used in commit subjects, so a row inserted
later keeps its own number rather than renumbering the rows below it.

| #  | Status | Commit | Title |
|----|--------|--------|-------|
| 1  | DONE   | 8d18721 | The X button silently discards the session: remove `clearDraft()` from `home()`, add it to the Readiness Cancel path (both `saveAndFinish` paths already call it), re-hydrate `draftSession` after `home()` so the banner shows without a cold boot, and make `startSession` refuse to overwrite an existing draft (offer resume or discard instead). |
| 9  | OPEN   |        | In-progress drafts are only persisted by a 5s `setInterval` (`index.html` ~835), so a crash, an OS kill or a tab discard loses up to 5 seconds of logged sets — the user re-enters weight and reps they already confirmed. Write the draft through on set completion as well as on the interval. **Size: HOURS.** |
| 2  | OPEN   |        | `ExerciseCard` reads `getExE1RM` backwards: the array is newest-first, but the card takes `e1rmData[length-1]` as current, so the displayed e1RM and the trend arrow both describe the oldest entries. |
| 3  | OPEN   |        | The dashboard frequency grid fills column-major (`grid[weekIdx*7+dow]`) but the CSS grid renders row-major, so every day lands in the wrong cell. |
| 4  | OPEN   |        | `tryIDBRecovery` only looks for `localStorage.getItem(k) === null`, so a key that is present but holds corrupt JSON never triggers recovery and the app boots empty while a good IndexedDB copy sits unused. |
| 5  | OPEN   |        | History renders `logs.slice(0, 50)` while `saveAndFinish` retains 100, so the oldest half of the user's history is unreachable with no paging or "show more". |
| 6  | OPEN   |        | `sw.js` derives `CACHE_NAME` from the app version string, and the version string bumps in the same commit as any `index.html` change; add a gate check in tests/ that fails when `index.html` changed and the version did not. Note: the commit that lands this is the first one the new check runs against, so bump the version in it. |
| 7  | OPEN   |        | Prefilled set values are logged untouched on tap: `startSession` seeds weight and reps from history, so tapping the check circle records numbers the user never entered or confirmed. |
| 8  | OPEN   |        | `applyImport` writes `KEYS.logs` without enforcing newest-first order, so an out-of-order backup file silently corrupts every helper that slices history by index (`getGhostSets`, `getProgression`, `shouldDeload`, `getFatigueTrend`). |
