# ABC Workout PWA — Changelog

Reverse chronological. Each entry captures what changed and why.

---

## v20 (Mar 7, 2026): Refactor + Smart Load + Debrief + Advisories + Wording Overhaul

Maintainability refactor plus 10 new features: per-exercise load suggestions, coached debrief, collapsible insights, fatigue/balance/carry advisories, time-available input, and operational wording throughout. Zero changes to workout philosophy or exercise programming.

### Codebase Refactor

- **10-section structure** with table of contents and labeled boundaries
- **6 named screen renderers** extracted from `App()` with clean router
- **Source baseline sync** — deployed version was ahead of project file; resync'd before refactoring

### Per-Exercise Suggested Load

- **`getSuggestedLoad()`** in Section 5 (Recommendations) — answers "what weight do I pick up for set 1?"
- Synthesizes progression engine verdict, readiness state, and carry advisory context into one number + reason
- Returns `{weight, reason}` or `null` (for bodyweight exercises / no history)
- **Collapsed card:** "Start: 35 lbs" replaces ghost line when available. Green for increase, amber for hold
- **Expanded card:** "Start: N lbs" in subtitle. Standalone reason card when no progression banner showing
- Does not auto-fill inputs or prevent manual override

### Coached Debrief

- **Completion screen "Next Session" card** — synthesized per-exercise guidance
- One line per exercise: hold/increase/skipped/sets done
- Final bold line: next session name + balance advisory if active
- Example: "Rows: start at 35 next session" / "Carries: skipped (double-day grip management)" / "Next: Session C"
- Appears between exercise summary and Session RPE selector
- Computed from `getProgression`, `PROG`, carry state, and `getBalanceAdvisory`

### Collapsible Insights

- **Home screen "Insights ▲/▼" toggle** — groups analytical cards (7-day volume, ACWR, deload warning, balance advisory) behind one collapsible header
- Default: open. Collapse persists within visit. Not persisted to localStorage
- Only renders when at least one insight card has content
- Stat cards, time selector, and recommendation button always visible
- Lighter alternative to a full Minimal/Coach mode system

### New Advisories

- **3-session fatigue trend** (`getFatigueTrend`) on readiness screen. Pattern A: monotonic RPE rise, floor 8, spread ≥1.5. Pattern B: avg RPE ≥7.5 with avg readiness ≤5/9
- **Pattern-balance advisory** (`getBalanceAdvisory`) on home screen. Flags core type absent from last 9 sessions. modC counts toward C-family. Suppressed when cycle engine already recommends absent type
- **Double-day carry warning** — banner on workout screen + "OPTIONAL" badge on carry cards + softened styling. Clears when carries completed

### Time-Available Input

- **3-option selector:** 10–15 min / 20–25 min / 30+ min. Default 20–25. Per-visit state
- **15 min:** caps warmup at standard, pre-selects circuit mode (visible note on warmup screen)
- **30+ min:** allows fuller warmup only if consistent with readiness logic (no override)
- **Format line** on recommendation card at 15 min and 30+ min

### Recommendation Transparency

- **Reason line** on home screen recommendation card: "Last completed: Session A", "Two sessions today → Modified C", etc.
- **`getRecReason()`** mirrors `getRec()` branching with human-readable output

### Export/Import Improvements

- Export includes `analysisTs`, shows "Backup saved!" feedback
- Import has confirmation dialog with session count/date, structural validation

### Week/Phase Language Removal

- `getTrainingWeek()` → `getSessionCount()` (non-manual session count)
- `getPeriodPhase()` rewritten with session-count thresholds and direct labels
- All UI labels updated: "Last 7 Days", "7-Day Volume", "Reduce Load", "next 1–3 sessions"

### Advisory Wording Pass

All user-facing messages rewritten for direct, operational language. Key changes:

| Area | Before | After |
|------|--------|-------|
| Progression (ready) | "Ready to progress → N lbs" | "2 sessions at target reps + RPE → N lbs" |
| Progression (hold) | "Maintain — RPE still high" | "RPE above target — hold current load" |
| Readiness low | "Loads will auto-adjust to maintain today" | "Readiness ≤4/9. Progression paused — maintain loads." |
| Score labels | Take it easy / Solid / Good / Let's go | Low / Moderate / High / Very High |
| Fatigue (systemic) | "possible systemic fatigue" | "All exercises RPE ≥8. Check sleep, stress, and recovery." |
| ACWR labels | High spike / Sweet spot | Spike risk / On track |
| HR recovery | "Fully recovered — go for it" | "Recovered" |
| Balance | "leaned away from ... consider it next" | "No C-family sessions in last 9. Consider Session C next." |

---

## v19 (Mar 2, 2026): Smart Logic + Analytics + UX Overhaul

Largest release to date — 16 features spanning analytics data layer, workout UX, and infrastructure.

### Smart Logic
- Estimated 1RM tracking (Epley formula)
- Weekly volume load with trend comparison
- ACWR (Acute:Chronic Workload Ratio)
- Auto-deload trigger (RPE + readiness trend)
- Fatigue fingerprinting (systemic vs endurance)

### Workout UX
- Ghost sets, PR detection, floating rest timer, audio tone
- Richer collapsed cards, Quick Start flow

### Completion Screen
- Session RPE capture, insights card, PR banner, volume summary
- Export for Claude analysis (structured clipboard copy)

### Infrastructure
- Centralized style tokens, data export/import, `wk-at` localStorage key

---

## v18 (Feb 25, 2026): Quick Wins + Load Optimization
- Progression badge on collapsed cards
- Preconnect hints, async font loading
- Removed dead haptic code

---

## v17 (Feb 25, 2026): iOS PWA Bottom Gap Fix
- Color-matching strategy for system safe area gap

---

## v10 (Feb 24-25, 2026): SNR-Weighted PPG Algorithm + UX Overhaul
## v9 (Feb 23, 2026): Advanced Features + HR Debugging
## v8 (Feb 23, 2026): Intelligence Layer
## v7 (Feb 21, 2026): Circuit Mode
## v6 (Feb 21, 2026): Deployment & Bug Fixes
## v5 (Feb 21, 2026): UX Overhaul — Scroll Elimination
## v1-v4 (Feb 20-21, 2026): Foundation
