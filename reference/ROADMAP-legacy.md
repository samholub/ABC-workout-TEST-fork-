# ABC Workout PWA — Roadmap

Planned features organized by scope and priority. Status updated as items progress.

-----

## Resolved — v18 through v20

Items 1–29 resolved across v18, v19, and v20. See CHANGELOG for details.

-----

## Resolved — v20.1 (Zero-Principles Rebuild)

Items 40–55: Draft persistence, empty session guard, validated reads, hardened S.set, import validation, error boundary, SRI hashes, schema migration, log cap warning, stable timer key, timezone fix, IndexedDB mirror, Service Worker, Game Plan screen, getPreSessionContext, set pre-fill, STYLES extraction.

-----

## Resolved — v21 (Premium Polish + Product Expansion)

### 56. UI Ergonomics Batch

- **Status:** ✅ Done — 44px check circles, inline RPE buttons, column headers, label removal, wider inputs, timer buttons, 2×2 footer grid

### 57. Outlier Weight Fix

- **Status:** ✅ Done — `getWorkingWeight` uses mode/median instead of max

### 58. Video Collapsibility

- **Status:** ✅ Done — tap-to-reveal iframe with inline Edit button

### 59. Carry Yards Label

- **Status:** ✅ Done — column header shows "Yards" for carry exercises

### 60. Avg Time "total" Label

- **Status:** ✅ Done — session cards show "Avg: 18m total"

### 61. RPE-Adaptive Rest Timer

- **Status:** ✅ Done — `getAdaptiveRest`, duration adjusts per RPE, label on floating timer

### 62. Training Dashboard

- **Status:** ✅ Done — 4 panels: e1RM trajectories, weekly volume, session frequency, RPE distribution

### 63. Personal Records Board

- **Status:** ✅ Done — all-time PRs per exercise group, PR distance on Game Plan

### 64. Historical Log Editing

- **Status:** ✅ Done — inline editing in history view, preserves all metadata

### 65. Export Version Fix

- **Status:** ✅ Done — `exportData` and `exportBackup` version corrected from 20 to 21

### 66. Face Pulls in Enhanced Warmup

- **Status:** ✅ Done — added "face pulls if band available" to Upper Body Prep step in Enhanced 3D warmup

-----

## Resolved — Hybrid Plan Document Review

Compared foundational documents (Optimal Hybrid Plan, ABC Cycle Workout quick reference, ChatGPT design brief V1.5, conversation extract) against current app state (v21, ARCHITECTURE.md).

### Findings

**Faithful to plan:** Session structures, exercise selections, warmup options, cycle logic, double-day rules, Modified C triggers, TGU as optional standalone, carry advisory, progression increments, advisory-only philosophy.

**Minor gaps identified (no immediate action required):**

- **Carry/pull-up set counts:** Plan says 2-3 sets, app defaults to 3. Within range, user can skip sets. No change needed — 3 is a reasonable default.
- **RPE graduated ramp:** Plan intended weeks 1-2 at RPE 6-7, weeks 3-4 at 7, weeks 5-6 at 7-8, weeks 7+ at 8. App uses flat RPE gates (8 for most, 9 for pulls, 7 for carries). New users at RPE 6-7 won't trigger progression (functionally correct behavior), but the gate doesn't adapt to training phase. See future feature item below.
- **Time compression tiers:** Plan had detailed compression rules (50-65/45-55/35-45/25-35/15-20 min with specific exercise drops). App has time-available input affecting warmup and format hints but doesn't modify exercise lists. Deliberate V1.5 simplicity choice. See future feature item below.
- **Load Targets week labels:** `LOAD_TARGETS` uses "w12/w34/w58/w912" (week-based framing). Only place where calendar-week language survived the session-count conversion. Acceptable since it's a reference table, not enforcement.

**Status:** ✅ Complete. Tracked since v20. Gaps documented below as future features.

-----

## Open — Needs Real-Device Field Testing

### Game Plan Screen UX Evaluation

- **What:** After 2-3 weeks of use, determine if the Game Plan screen is a useful pause or a speed bump. May need Quick Start bypass or collapsible format
- **Status:** Monitoring

### Dashboard Data Density

- **What:** Dashboard charts are sparse with <20 sessions. Evaluate whether Dashboard earns home footer real estate early, or should be tucked away until data accumulates
- **Status:** Monitoring

### RPE Button Size

- **What:** RPE buttons are 28px circular. May need 32px for sweaty-finger reliability
- **Status:** Needs field testing

### Advisory Density

- **What:** Re-evaluate whether the app surfaces too much or too little information during the pre-workout flow (readiness → game plan → warmup → workout)
- **Status:** Needs field testing after 2-3 weeks of real usage

-----

## Training Programming Features — Implementation-Ready Specs

### 70. Pull-Up Grip Toggle

- **What:** Session-level grip selection for pull-up exercises. Options: Pull-Up / Chin-Up / Mixed (default). Current behavior is Mixed (note says "Sets 1-2: Pull-ups. Final set: Chin-ups")
- **Why:** Allows concentrated stimulus per session instead of splitting every session. Legitimate training preference
- **Implementation pattern:** Follow carry type toggle exactly. New localStorage key `wk-grip` (or add `gripType` field to exercise). UI: one-tap toggle on pull-up exercise cards, same placement as carry type selector. Default: "Mixed" (preserves current behavior). When Pull-Up or Chin-Up selected, update the exercise `note` to reflect single-grip guidance. Track grip choice in log data for balance advisory input
- **Data model:** `gripType: "mixed" | "pullup" | "chinup"` — stored per session in log, persisted in `wk-grip` as default preference
- **Effort:** Small. Carry type toggle is the exact template
- **Prerequisite:** Field testing confirms mixed approach feels insufficient
- **Status:** Spec ready, not implemented

### 71. Dynamic Modified C Composition (Advisory Substitution)

- **What:** Game Plan screen suggests exercise substitutions for Modified C based on recent training balance. E.g., "Recent sessions are press-heavy. Consider rows instead of OHP today"
- **Why:** ModC is the "fill the gaps" session. Fixed composition (OHP + Pull-Ups + Carries) doesn't adapt to what gaps actually exist
- **Design decision:** Advisory substitution (Approach B), not multiple modC variants. ModC template stays fixed. Game Plan shows a contextual swap suggestion. User taps to accept or ignores
- **Implementation:**
  1. Extend `getBalanceAdvisory` (or new `getSubstitutionAdvisory`) to analyze movement patterns, not just session types. Look at pressing vs pulling vs hinge vs squat volume in last 9 sessions
  2. Map exercises to movement patterns: OHP→press, rows→pull-horizontal, pull-ups→pull-vertical, pushups→press-horizontal, BSS→squat, SLDL→hinge, carries→carry
  3. On Game Plan for modC, if press volume is high relative to pull, suggest "Rows instead of OHP." If pull volume is high, suggest "Push-ups instead of OHP" (OHP is the most substitutable slot in modC)
  4. UI: swap suggestion card on Game Plan with "Swap" / "Keep Original" buttons. If swapped, use the substitute exercise's progression data and pre-fill
  5. Log the actually-performed exercise, not the template default — this is critical for balance tracking accuracy
- **Complexity:** Medium. Requires movement pattern classification, substitution logic, and dynamic exercise swap in the workout flow. The swap must propagate through pre-fill, ghost sets, PR detection, and debrief
- **Prerequisite:** Field testing, Game Plan evaluation
- **Status:** Spec ready, not implemented

### 72. RPE Graduated Ramp for New Users

- **What:** Lower RPE progression gates during early training phases. Session count 1-8: gate at RPE 7. Sessions 9-20: gate at RPE 7.5. Sessions 21+: current gates (8/9/7)
- **Why:** Hybrid plan intended weeks 1-2 at RPE 6-7, ramping to 8 by week 7+. Current flat gates work correctly (new users at low RPE won't trigger progression) but the messaging doesn't reflect the phase. A user in session 3 hitting RPE 7 should be told "On track — building consistency" not "Maintain weight (RPE below threshold)"
- **Implementation:** Modify `getProgression` to accept `sessionCount` (already passed) and adjust `cfg.rpe` gate based on `getPeriodPhase`. Early phase: gate = max(cfg.rpe - 1, 7). Building phase: gate = max(cfg.rpe - 0.5, 7). Established+: current gates unchanged
- **Effort:** Small — logic change in one function, affects messaging not behavior
- **Status:** Spec ready, not implemented

### 73. Time Compression Guidance

- **What:** When time-available input is ≤15 min, Game Plan suggests specific exercises to drop. When 25-35 min, suggests full session. When 15-20 min, suggests "survival mode" picks from hybrid plan
- **Why:** Hybrid plan had detailed compression tiers with specific exercise priorities. App currently defers exercise selection entirely to user under time pressure
- **Implementation:**
  1. Define exercise priority per session (which to keep, which to drop first). For each session, exercises have a priority rank
  2. Session A priority: BSS > Push-Ups > Carries. Session B: SLDL > Rows > Carries. Session C: BSS > Pull-Ups > SLDL
  3. On Game Plan, if `timeAvail ≤ 15`, show "Compressed: focus on [top 2 exercises], consider dropping [lowest priority]" as advisory text
  4. Does NOT modify the exercise cards or hide exercises. Advisory only — user decides what to skip
- **Effort:** Small — data mapping + conditional text on Game Plan
- **Prerequisite:** Field testing confirms time pressure is a real friction point
- **Status:** Spec ready, not implemented

-----

## Medium Features — Open

### 31. Screen Slide Transitions + Back-Swipe Gesture

- **Effort:** Medium
- **Status:** Not implemented

### 32. HR Recovery Tracking (Delta Between Two Readings)

- **Effort:** Medium
- **Status:** Not implemented

### 33. ACWR Integration with Readiness System

- **What:** Feed ACWR ratio into progression decisions automatically
- **Status:** Not implemented

-----

## HR Accuracy Optimization Stack

### 35-38. Ultra Wide Camera, Signal Quality Feedback, Longer Sampling, Exposure Control

- **Status:** Not implemented. Feature is experimental and not actively developed

-----

## Training Programming Notes — Future Consideration

- Shoulder/back rehab: face pulls added to Enhanced warmup ✅. Periodic advisory concept (surface rehab reminders after N press-heavy sessions) deferred — would need a tip rotation system
- Vertical pulling variation: grip toggle spec captured as item 70
- A/B/C structure refinement: overhead press for C-day already implemented as Modified C
- Upper-body rotation: dynamic modC composition spec captured as item 71

-----

## Long-Term / Large Features

### Cloud Sync

- **Decision:** Deferred. SW + IDB provides local redundancy. Cloudflare Worker + KV recommended if pursued
- **Prerequisite:** Service Worker ✅

### JSX Migration

- Requires build tooling, conflicts with zero-build philosophy

-----

## Priority Order

1. **Fix export version bug** — ✅ Done (version:20 → version:21)
2. **Real-device field testing** — use the app for 2-3 weeks, collect observations
3. **Production merge** — move v21 from test fork to production repo after field testing
4. **Evaluate Game Plan flow** — keep, simplify, or add bypass based on usage
5. **Grip toggle for pull-ups (item 70)** — small feature, follows carry type pattern
6. **Screen transitions (item 31)** — biggest feel improvement after current polish
7. **Dynamic modC composition (item 71)** — advisory substitution on Game Plan
8. **ACWR → readiness integration (item 33)** — makes analytics influence training
9. **RPE graduated ramp (item 72)** — new user experience improvement
10. **Time compression guidance (item 73)** — plan's detailed tiers surfaced as advisory

-----

## Pending Tasks

- **Production merge:** Deploy v21 from test fork to main repo after field validation
