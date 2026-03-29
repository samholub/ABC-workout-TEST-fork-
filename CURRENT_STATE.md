# ABC Workout PWA — Current State

**Version:** v20 (Mar 7, 2026)
**URL:** https://samholub.github.io/ABC-workout/
**Repo:** `samholub/ABC-workout` on GitHub (main branch)
**Debug tool:** https://samholub.github.io/ABC-workout/hr-debug.html

---

## What's Deployed

Single-file React PWA for tracking an asymmetric, multi-planar ABC cycle workout program on iPhone. Hosted on GitHub Pages. Refactored into 10 labeled sections for maintainability.

### Core Features (All Working)

- **ABC cycle rotation** with double-day and Modified C logic, TGU optional insert
- **Workout tracking:** Set/rep/weight/RPE logging per exercise with accordion card UX and auto-advance
- **Circuit mode:** Toggle between standard (all sets per exercise) and round-robin rotation
- **Readiness check-in:** 3 quick taps pre-session (sleep, soreness, motivation) → readiness score (Low / Moderate / High / Very High)
- **Smart warmup suggestions:** Auto-recommends warmup based on readiness score + session type + time available
- **Auto-progression engine:** RPE-gated — requires hitting top of rep range AND RPE ≤ target for 2 consecutive sessions before suggesting load increase
- **Per-exercise suggested load:** `getSuggestedLoad()` answers "what weight do I pick up?" — shows "Start: N lbs" on exercise cards with color coding (green for increase, amber for hold). Uses progression engine, readiness, and carry context
- **Coached debrief:** Completion screen shows "Next Session" card with per-exercise action items (hold/increase/skip) and next session recommendation with balance advisory
- **Collapsible insights:** Home screen groups volume, ACWR, deload, and balance advisory under toggleable "Insights ▲/▼" header. Default open, persists within visit
- **Progression badge on collapsed cards:** Green `⬆ READY` pill badge when progression criteria met
- **Session pacing:** Visual indicators for workout tempo and rest compliance
- **Progression charts:** SVG line charts per exercise showing weight over time with RPE-colored dots
- **Rest timer:** Countdown with pause/resume/skip, auto-starts on set completion (60/75/90/120s options)
- **Form cues** per exercise, YouTube video references, carry type toggle (suitcase vs farmer's)
- **Session history** with expandable detail and manual log entry
- **Average session time** tracked and displayed on session cards
- **B3 pill button design** across all footers and sheets
- **HR spot-check:** Experimental camera-based PPG during rest periods (SNR-weighted multi-channel algorithm v2)

### New in v20

- **Codebase refactored into 10 sections** with TOC and named screen render functions
- **Per-exercise suggested load** (`getSuggestedLoad`) on collapsed and expanded exercise cards
- **Coached debrief** on completion screen — per-exercise next-session guidance
- **Collapsible insights** on home screen — toggle analytical cards behind "Insights" header
- **Enhanced AI export** with structured prompt, per-set e1RM, progression status, clipboard feedback
- **Export/import hardened** — confirmation step, validation, `analysisTs` included
- **3-session fatigue trend** (`getFatigueTrend`) on readiness screen
- **Pattern-balance advisory** (`getBalanceAdvisory`) on home screen
- **Double-day carry warning** with OPTIONAL badge on carry cards
- **Time-available input** (10–15 / 20–25 / 30+ min) shaping warmup and circuit pre-selection
- **Recommendation reason line** on home screen session card
- **Session-count training focus** replacing calendar-week logic
- **Week-free language** and **operational advisory wording** throughout

### Known Issues

- **HR accuracy:** Further optimization needed (see ROADMAP.md)
- **No haptic feedback:** iOS Safari limitation. Audio fallback rejected
- **Style tokens partial adoption:** Full migration deferred
- **No offline service worker**
- **Floating timer re-mounts on set change**

---

## Tech Stack

- Single HTML file (`index.html`, ~1079 lines, 10 labeled sections)
- React 18 via CDN (cdnjs.cloudflare.com), no build tools
- `React.createElement` directly (no JSX, no transpiler)
- All state in localStorage
- Styled inline
- GitHub Pages deployment, push via GitHub API from iPhone
- Preconnect hints + async font loading for fast first paint
- AudioContext API for rest timer audio cue

---

## Files in Repo

| File | Purpose |
|------|---------|
| `index.html` | Main workout app (v20) |
| `hr-debug.html` | Standalone HR diagnostic tool for algorithm development |
