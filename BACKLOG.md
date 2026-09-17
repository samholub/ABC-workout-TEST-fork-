# BACKLOG

One row per commit. The loop takes the top `OPEN` row, fixes exactly that,
runs `npm run check`, and marks the row `DONE` with the commit hash. On a
failing check the row is marked `BLOCKED` with the reason and the working
tree is reverted.

Status is one of `OPEN`, `DONE`, `BLOCKED`. This list is defects first;
feature rows only with Sam's explicit approval and a one-line why, placed
after all OPEN defect rows.

Rows are worked in the order they appear, not by number: the top `OPEN` row
is next. The `#` is a stable id used in commit subjects, so a row inserted
later keeps its own number rather than renumbering the rows below it.

| #  | Status | Commit | Title |
|----|--------|--------|-------|
| 1  | DONE   | 8d18721 | The X button silently discards the session: remove `clearDraft()` from `home()`, add it to the Readiness Cancel path (both `saveAndFinish` paths already call it), re-hydrate `draftSession` after `home()` so the banner shows without a cold boot, and make `startSession` refuse to overwrite an existing draft (offer resume or discard instead). |
| 9  | DONE   | c7d9f32 | In-progress drafts are only persisted by a 5s `setInterval` (`index.html` ~835), so a crash, an OS kill or a tab discard loses up to 5 seconds of logged sets — the user re-enters weight and reps they already confirmed. Write the draft through on set completion as well as on the interval. **Size: HOURS.** |
| 2  | DONE   | 16c3b5e | `ExerciseCard` reads `getExE1RM` backwards: the array is newest-first, but the card takes `e1rmData[length-1]` as current, so the displayed e1RM and the trend arrow both describe the oldest entries. |
| 3  | DONE   | dbb57c8 | The dashboard frequency grid fills column-major (`grid[weekIdx*7+dow]`) but the CSS grid renders row-major, so every day lands in the wrong cell. |
| 4  | DONE   | 7a7b14a | `tryIDBRecovery` only looks for `localStorage.getItem(k) === null`, so a key that is present but holds corrupt JSON never triggers recovery and the app boots empty while a good IndexedDB copy sits unused. |
| 5  | DONE   | 64fa9bf | History renders `logs.slice(0, 50)` while `saveAndFinish` retains 100, so the oldest half of the user's history is unreachable with no paging or "show more". |
| 10 | DONE   | 9a865c3 | `sw.js` answers a navigation from the cache and only revalidates in the background (`return cached \|\| networkFetch`, `sw.js:48`), so the first open after every deploy renders the previous build and the new one appears a launch later. |
| 13 | DONE   | 727a097 | `sw.js` caches any navigation response that is `response.ok`, so a captive-portal or hotel-wifi sign-in page returning 200 is written into the cache under the app's own URL and served on the next offline open. Introduced by row 10. Two conditions fix it: fall back to the cached page unless `response.ok`, and only `cache.put` a response whose `type` is `basic`. **Size: SMALL.** |
| 6  | DONE   | 9760049 | `sw.js` hardcodes `CACHE_NAME = 'abc-workout-v2'` (`sw.js:1`) while the app version string lives in `index.html` (banner `v21` at :38, home header at :925) -- two unrelated numbers, neither of which anything bumps. `activate` only purges caches whose name differs, so the precached entries survive every deploy and a stale asset is served until the name is edited by hand. Fix: one version value both files carry -- `index.html` declares it and `sw.js` builds `CACHE_NAME` from its own copy (no build step, so they cannot share a symbol) -- bumped with any `index.html` change, plus a gate check in tests/ that fails when `index.html` changed and the version did not, and when the two copies disagree. Leave `version: 21` in the export payloads alone: that is the export schema field and `applyImport` never reads it. Note: the commit that lands this is the first one the new check runs against, so bump the version in it. |
| 8  | DONE   | 994c626 | `applyImport` writes `KEYS.logs` without enforcing newest-first order, so an out-of-order backup file silently corrupts every helper that slices history by index (`getGhostSets`, `getProgression`, `shouldDeload`, `getFatigueTrend`). |
| 11 | DONE   | f64ba23 | Row 9 writes the draft through when a set is completed, but the same handler still leaves un-completing a set or editing a logged weight/rep value to the 5s `setInterval`, so a crash within those 5s restores the set the user just corrected or cleared. |
| 7  | OPEN   |        | Prefilled weight/reps from history render dimmed (placeholder style) until the user edits them or taps the check circle; either action makes them solid and logs them. One tap still logs a set. No confirm prompt. Size small. |
| 12 | OPEN   |        | FEATURE (approved by Sam): on the debrief screen, show a one-tap "Export backup" button every 10th completed session, reusing the existing `exportBackup`. Why: a manual JSON export is the only durable copy of the user's history. |
