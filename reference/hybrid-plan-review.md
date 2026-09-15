# ABC Workout — Hybrid Plan Review

**Reviewed:** April 4, 2026
**Reviewer:** Claude (Opus), with Sam
**Conclusion:** The app is a faithful implementation of the hybrid plan. No critical drift. Minor gaps documented below. Plan validated as the right approach.

-----

## Documents Reviewed

| Document | What It Is | Role in Review |
|----------|-----------|----------------|
| `Optimal_Hybrid_Plan.txt` | The foundational training program — session structures, exercise selections, warmup options, progression rules, RPE timelines, time compression tiers, double-day rules | **Primary source of truth** for what the app should implement |
| `ABC_CYCLE_WORKOUT.txt` | Quick reference card version of the hybrid plan — same content, condensed format | Cross-reference to confirm plan details |
| `ChatGPT_design_brief_-_030626` | Product philosophy document (V1.5) — simplicity over optimization, recommendations not enforcement, manual override always available, no calendar-week accounting | **Primary source of truth** for how the app should behave |
| `ABC_workout_conversation_extract.md` | Chronological record of design decisions — V1 → V2 exploration → V1.5 resolution, feature implementations, rejected ideas, brainstorming outcomes | Context for why decisions were made |
| `ARCHITECTURE.md` | Current app technical reference — session definitions, data model, function inventory, screen flow, design decisions | **What the app actually does** — compared against plan |
| `index.html` (v21, 1484 lines) | The actual codebase — session configs, progression engine, warmup data, all logic | **Ground truth** for implementation details |

-----

## What Was Compared

### 1. Session Structure (Plan → App)

| Element | Hybrid Plan | App (v21) | Match? |
|---------|------------|-----------|--------|
| Session A exercises | BSS, Push-Ups, Suitcase Carry | BSS, Push-Ups, Suitcase Carry | ✅ Exact |
| Session B exercises | SLDL, SA Rows, Carries | SLDL, SA Rows, Carries | ✅ Exact |
| Session C exercises | BSS, Pull-Ups/Chin-Ups, SLDL | BSS, Pull-Ups/Chin-Ups, SLDL | ✅ Exact |
| Modified C exercises | OHP, Pull-Ups/Chin-Ups, Carries | OHP, Pull-Ups/Chin-Ups, Carries | ✅ Exact |
| TGU | 5 reps/side, light-moderate, optional | 5 reps/side, light-moderate, optional | ✅ Exact |
| Session A time | 15 min | 15 min | ✅ Exact |
| Session B time | 15 min | 15 min | ✅ Exact |
| Session C time | 20 min | 20 min | ✅ Exact |
| Modified C time | 15-18 min | 15-18 min | ✅ Exact |
| TGU time | 15 min | 15 min | ✅ Exact |

### 2. Set/Rep Schemes

| Exercise | Plan | App | Match? |
|----------|------|-----|--------|
| BSS | 3 × 8-10/leg | 3 × 8-10/leg | ✅ |
| Push-Ups | 3 × 8-15 | 3 × 8-15 | ✅ |
| Carries | **2-3** × 40 yd/side | **3** × 40 yd/side | ⚠️ App defaults to top of range |
| SLDL | 3 × 8-10/leg | 3 × 8-10/leg | ✅ |
| SA Rows | 3 × 8-12/arm | 3 × 8-12/arm | ✅ |
| Pull-Ups | **2-3** sets total | **3** sets | ⚠️ App defaults to top of range |
| OHP | 3 × 8-10/arm | 3 × 8-10/arm | ✅ |
| TGU | 1 × 5/side | 1 × 5/side | ✅ |

### 3. Progression Rules

| Rule | Plan | App (`PROG` config) | Match? |
|------|------|---------------------|--------|
| Add weight trigger | Top of rep range for 2 consecutive sessions at target RPE | 2-session rule, RPE-gated | ✅ |
| Lower body increment | +5-10 lbs | BSS: +5, SLDL: +5 | ✅ (conservative end) |
| Upper body increment | +2.5-5 lbs | OHP: +2.5, Row: +5 | ✅ |
| Carry increment | +5 lbs | +5 | ✅ |
| Pull-up progression | RPE-based (no weight increment for BW) | `inc:0, rpe:9` | ✅ |
| RPE targets (established) | RPE 8 standard, 8-9 for pulls/carries | BSS/SLDL/Row/OHP: 8, Pulls: 9, Carries: 7 | ✅ |

### 4. RPE Timeline (New User Ramp)

| Phase | Plan | App | Match? |
|-------|------|-----|--------|
| Weeks 1-2 (sessions 1-8) | RPE 6-7 | Gate at RPE 8 (flat) | ⚠️ Gap |
| Weeks 3-4 (sessions 9-16) | RPE 7 | Gate at RPE 8 (flat) | ⚠️ Gap |
| Weeks 5-6 (sessions 17-24) | RPE 7-8 | Gate at RPE 8 (flat) | ✅ Close enough |
| Weeks 7+ (sessions 25+) | RPE 8 | Gate at RPE 8 | ✅ Exact |

**Note:** The flat gate is functionally correct — a new user at RPE 6-7 won't trigger progression because they're below the gate. But the *messaging* doesn't reflect the phase. A user in session 3 hitting RPE 7 should hear "On track — building consistency" not "RPE below threshold." See ROADMAP item #72.

### 5. Cycle Logic

| Rule | Plan | App | Match? |
|------|------|-----|--------|
| Rotation | A → B → C, continuous | `CYCLE=["A","B","C"]`, never resets | ✅ |
| Double-day trigger | A(am) + B(pm) → modC next day | `isDoubleDay` flag, modC recommendation | ✅ |
| B carries on double-day | Drop carries, shift to modC | Carry advisory marks as OPTIONAL, modC note says "From dropped B session" | ✅ |
| TGU doesn't break cycle | Resume from where you left off | `preTgu` preserves cycle position | ✅ |
| modC counts as C-family | Implied by structure | `getBalanceAdvisory` counts modC toward C | ✅ |

### 6. Warmup Options

| Warmup | Plan | App (`WARMUPS` array) | Match? |
|--------|------|-----------------------|--------|
| Enhanced 3D (8-10 min) | 4 phases: Hip Mobility, 3D Lunge Matrix, Upper Body Prep, Integration | All 4 phases present with correct exercises | ✅ |
| Standard 3D (5 min) | 3D Lunge Matrix only | Correct | ✅ |
| Hip Mobility Flow (5 min) | General movement → hip mobility → movement prep | Correct | ✅ |
| Emergency (1-3 min) | 20 jumping jacks + 10 squats | Correct | ✅ |
| Face pulls | Not in original plan | Added to Enhanced warmup Upper Body Prep step (April 2026) | ✅ Enhancement |

### 7. Pull-Up Protocol

| Detail | Plan | App | Match? |
|--------|------|-----|--------|
| Grip pattern | First 1-2 sets: Pull-ups, Final set: Chin-ups | Exercise `note`: "Sets 1-2: Pull-ups. Final set: Chin-ups" | ✅ |
| Display name | Pull-Ups/Chin-Ups | "Pull-Ups / Chin-Ups" | ✅ |

### 8. Time Compression

| Tier | Plan | App | Match? |
|------|------|----|--------|
| 50-65 min (full) | All 6 exercises + OHP, full warmup, 60-90s rest | Not represented | ❌ Not implemented |
| 45-55 min (standard) | All 6 exercises, full warmup | Default behavior | ✅ Implicit |
| 35-45 min (compressed) | Skip warmup, all exercises, 45-60s rest | Time selector affects warmup suggestion | ⚠️ Partial |
| 25-35 min (emergency) | Minimal warmup, drop rows and pull-ups | Time selector shows format hints only | ⚠️ Advisory only |
| 15-20 min (survival) | Pick 3 exercises | Not implemented | ❌ Not implemented |

**Note:** The plan envisioned the app helping users decide what to cut under time pressure. The app currently defers this entirely to the user. This was a deliberate V1.5 simplicity choice. See ROADMAP item #73.

### 9. Philosophy Alignment

| Principle (Design Brief) | App Behavior | Match? |
|--------------------------|-------------|--------|
| Recommendations over enforcement | All advisories are soft, manual override everywhere | ✅ |
| No calendar-week accounting | Session-count based (`getSessionCount`), "Last 7 Days" not "This Week" | ✅ |
| Missed days don't break anything | Continuous cycle, no reset logic | ✅ |
| Double days handled gracefully | `isDoubleDay` flag, modC trigger, carry advisory | ✅ |
| Intelligence is rare and trustworthy | Fatigue trend fires only on clear patterns (3-session lookback, tight thresholds) | ✅ |
| No backend/cloud dependency | localStorage + IndexedDB, static deployment | ✅ |
| Manual override always available | Every advisory can be ignored, every session selectable | ✅ |
| Don't become dashboard-heavy | Dashboard exists but behind footer nav, not on home screen | ✅ |

-----

## Conclusions

### Why This Plan Works

1. **The exercise selection covers all movement patterns** with minimal equipment (dumbbells only). Squat (BSS), hinge (SLDL), horizontal push (push-ups), horizontal pull (rows), vertical pull (pull-ups/chin-ups), overhead press (OHP), loaded carry, and full-body integration (TGU). No gaps.

2. **The ABC rotation with no weekly reset** is the key differentiator. It removes guilt about missed days, handles irregular schedules gracefully, and naturally distributes volume over time without enforcement. The app's cycle engine implements this correctly.

3. **Modified C solves the double-day problem** elegantly. Instead of inventing rules about what to do after A+B same day, the plan defines a specific session (OHP + pulls + carries) that fills the gaps left by dropping B's carries. The app implements the trigger and the session correctly.

4. **RPE-gated progression prevents premature loading.** The 2-session rule (hit top of range at target RPE for 2 consecutive sessions before adding weight) is conservative and appropriate for a solo trainee without a coach watching form. The app's `getProgression` function implements this correctly, using `getWorkingWeight` (mode/median) to prevent outlier heavy sets from corrupting the signal.

5. **The philosophy layer (V1.5 design brief) prevents feature creep.** The four-question test ("Does this reduce friction? Preserve simplicity? Help without controlling? Work with messy schedules?") has been effective at filtering ideas. The app reflects this — every advisory is soft, every recommendation is overridable.

### What Drifted (Minor — No Action Required)

- **Carry/pull-up set counts:** Plan says 2-3, app defaults to 3. Within range, and the user can always skip a set. Not worth adding set-count flexibility UI for a single-user app.
- **Load Targets week labels:** The `LOAD_TARGETS` reference table still uses "Wk 1-2 / Wk 3-4" labels. This is the one place where calendar-week framing survived the session-count conversion. Acceptable since it's a reference table, not enforcement.

### What's Missing (Documented as Future Features)

- **RPE graduated ramp (#72):** Plan intended a 6-7 → 7 → 7-8 → 8 ramp over the first ~25 sessions. App uses flat RPE gates. Functionally correct but messaging doesn't reflect phase. Spec written in ROADMAP.
- **Time compression guidance (#73):** Plan had detailed tiers with specific exercise-drop priorities. App has time-available input affecting warmup and format hints but doesn't suggest what to cut. Spec written in ROADMAP.
- **Grip toggle (#70):** Plan defines mixed grip (pull-ups then chin-ups within session). User wants option for session-level grip cycling. Spec written in ROADMAP.
- **Dynamic modC (#71):** Plan defines fixed modC. User wants advisory substitution based on recent training balance. Spec written in ROADMAP.

### What Was Evaluated and Rejected

These ideas were considered during the V1 → V2 → V1.5 evolution (documented in `ABC_workout_conversation_extract.md`) and rejected for specific reasons:

| Idea | Why Rejected |
|------|-------------|
| A-B-A / B-A-B alternating pattern | Adds scheduling complexity without clear benefit over continuous rotation |
| Mandatory agonist-antagonist supersets | Forces structure that conflicts with time flexibility |
| Goblet squats (bilateral) replacing BSS | BSS provides unilateral balance correction that bilateral doesn't |
| Anti-extension core as separate exercise | Already addressed through carries and TGU |
| Volume vs. progression slot separation | Premature optimization for a program focused on consistency |
| useReducer migration | Risk exceeds benefit in untested single-file codebase |
| Multi-file architecture split | Valid at >2000 lines, premature at 1484 |
| localStorage encryption | No sensitive data stored, adds complexity |
| Web Bluetooth HR | iOS Safari doesn't support it |
| Cloud sync | Service Worker + IndexedDB provides local redundancy, no backend needed yet |

-----

## Summary

The hybrid plan is the right plan. The app implements it faithfully. The minor gaps are documented with implementation specs for when they become priorities. The philosophy layer is intact and actively filtering complexity. The next phase is real-device field testing to validate that the implementation *feels* right in practice, not just on paper.