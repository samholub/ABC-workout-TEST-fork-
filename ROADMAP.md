# ABC Workout PWA — Roadmap

Planned features organized by scope and priority. Status updated as items progress.

-----

## Resolved — v18

### 1–3. Haptic (dropped), Rest Timer Auto-Start (already working), Progression Badge

- **Status:** All resolved in v18

-----

## Resolved — v19

### 4–18. Ghost Sets, PRs, Floating Timer, Audio Tone, Quick Start, Style Tokens, e1RM, Session RPE, Export, Backup, Collapsed Cards, Volume, ACWR, Deload, Fatigue

- **Status:** All resolved in v19

-----

## Resolved — v20

### 19. Codebase Refactor

- **Status:** ✅ Done — 10-section structure, named screen renderers, TOC

### 20. Fatigue Trend Advisory

- **Status:** ✅ Done — `getFatigueTrend()`, 3-session lookback, Pattern A (climbing RPE) + Pattern B (sustained high + low readiness)

### 21. Pattern-Balance Advisory

- **Status:** ✅ Done — `getBalanceAdvisory()`, 9-session window, C-family grouping

### 22. Double-Day Carry Warning

- **Status:** ✅ Done — Advisory banner + OPTIONAL badge on carry cards

### 23. Time-Available Input

- **Status:** ✅ Done — 3-option selector, warmup constraint, circuit pre-selection

### 24. Recommendation Transparency

- **Status:** ✅ Done — `getRecReason()` with visible reason line

### 25. Calendar-Week Language Removal

- **Status:** ✅ Done — `getSessionCount()` replaces `getTrainingWeek()`

### 26. Advisory Wording Pass

- **Status:** ✅ Done — All messages rewritten for operational language

### 27. Per-Exercise Suggested Load

- **Status:** ✅ Done — `getSuggestedLoad()` shows “Start: N lbs” on exercise cards. Synthesizes progression + readiness + carry context. Green for increase, amber for hold. Null for bodyweight exercises

### 28. Coached Debrief

- **Status:** ✅ Done — “Next Session” card on completion screen. Per-exercise action items + next session with balance advisory. Deterministic text assembly from existing data

### 29. Collapsible Insights

- **Status:** ✅ Done — Home screen “Insights ▲/▼” toggle grouping volume, ACWR, deload, and balance advisory. Default open. Lighter alternative to Minimal/Coach mode

-----

## Medium Features — Open

### 30. Full Style Token Migration

- **What:** Replace all remaining hardcoded hex values with `T.` token references
- **Effort:** Medium — mechanical find-and-replace through legacy code
- **Status:** Not implemented

### 31. Screen Slide Transitions + Back-Swipe Gesture

- **What:** CSS slide animations between screens, touch-based back swipe
- **Effort:** Medium
- **Status:** Not implemented

### 32. HR Recovery Tracking (Delta Between Two Readings)

- **What:** Paired HR reading mode: post-set → wait 60s → measure again → show delta
- **Effort:** Medium — small state machine, HR capture code exists
- **Status:** Not implemented

### 33. Overall Trend Dashboard

- **What:** Dashboard showing volume over time, RPE trends, session frequency, e1RM progression
- **Effort:** Medium-large. Build after enough data accumulates
- **Status:** Not implemented

### 34. ACWR Integration with Readiness System

- **What:** Feed ACWR ratio into progression decisions automatically
- **Status:** Not implemented

-----

## HR Accuracy Optimization Stack

### 35. Ultra Wide Camera Selection for PPG

- High-impact hardware optimization — less sensor saturation

### 36. Real-Time Signal Quality Feedback

- Prompt repositioning if StdDev < 2.0

### 37. Longer Sampling Window Option

- Extend from 15s to 20-30s

### 38. Exposure Control (If Available)

- Lower priority due to iOS Safari API unreliability

-----

## Training Programming Notes — Future Consideration

These are coaching and exercise selection ideas being considered for personal training structure. Documented here as potential inputs for future app features (e.g., exercise rotation hints, rehab movement cues, workout template suggestions).

- **Shoulder/back rehab:** Incorporate face pulls periodically for shoulder and back maintenance
- **Vertical pulling variation:** Cycle between chin-ups and pull-ups to balance biceps and back involvement
- **A/B/C structure refinement:** Reserve overhead dumbbell press for C-day workouts (remove Bulgarian split squat and single-leg deadlift from C if A+B completed previous day)
- **Upper-body rotation:** Rows, pushups, and pull-ups rotate regularly if A/B/C structure changes are adopted

**Status:** Under consideration. No app feature changes required at this time.

-----

## Long-Term / Large Features

### 39. Offline Service Worker

### 40. JSX Migration

-----

## Priority Order

1. **Style token migration (item 30):** Cleanup before adding more features
1. **Screen transitions + back-swipe (item 31):** Biggest feel improvement
1. **ACWR → readiness integration (item 34):** Makes analytics influence training
1. **HR accuracy (items 35-36):** Ultra Wide camera + signal quality
1. **Trend dashboard (item 33):** After enough data accumulates
1. **HR recovery tracking (item 32):** Gives HR monitor genuine training utility