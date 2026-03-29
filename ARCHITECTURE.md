# ABC Workout PWA — Architecture & Technical Reference

-----

## Training Program (The “ABC” System)

Derived from research comparing asymmetric multi-planar training approaches with flexible functional training philosophies. Prioritizes unilateral/offset exercises across all three movement planes (sagittal, frontal, transverse) with RPE-based autoregulation.

### Sessions

|Session       |Time     |Exercises                                                       |
|--------------|---------|----------------------------------------------------------------|
|**A**         |15 min   |Bulgarian Split Squats, Push-Ups, Suitcase Carry                |
|**B**         |15 min   |Single-Leg Deadlifts, Single-Arm Rows, Carries                  |
|**C**         |20 min   |Bulgarian Split Squats, Pull-Ups/Chin-Ups, Single-Leg Deadlifts |
|**Modified C**|15-18 min|SA Overhead Press, Pull-Ups, Carries (used after A+B double-day)|
|**TGU**       |15 min   |Turkish Get-Up (optional variety session)                       |

### Cycle Logic

- Rotates A → B → C → A → B → C…
- Double-day support: if you do two sessions in one day, next day uses Modified C
- TGU is an optional insert that doesn’t break the cycle
- Modified C counts toward C-family for balance tracking (both include vertical pulling)

### Warmup Options

- **Enhanced 3D** (8-10 min): Hip mobility + lunge matrix + upper body + integration
- **Standard 3D** (5 min): 2x5 each direction lunge matrix
- **Hip Mobility** (5 min): General movement + hip mobility + movement prep
- **Emergency** (1-3 min): 20 jumping jacks + 10 BW squats

Smart warmup auto-recommends based on readiness score + session type + time available. Time constraint (10–15 min) caps warmup at standard/emergency. 30+ min does not override readiness logic.

-----

## App Architecture

### File Structure (10 Sections)

The single `index.html` is organized into 10 labeled sections with a table of contents at the top:

|# |Section            |Contents                                                                                                                                          |
|--|-------------------|--------------------------------------------------------------------------------------------------------------------------------------------------|
|1 |Core Setup         |React aliases (`R`, `e`, `useState`, etc.), `S` storage helper, `KEYS` object                                                                     |
|2 |Theme Tokens       |`var T={...}` centralized color palette                                                                                                           |
|3 |Data Layer         |`SESSIONS`, `WARMUPS`, `CYCLE`, `PROG`, `EX_GROUP`, `FORM_CUES`, `CARRY_TYPES`, `LOAD_TARGETS`                                                    |
|4 |Analytics & Metrics|`calcE1RM`, `getExE1RM`, `detectPRs`, `getGhostSets`, `calcVolume`, `calcACWR`, `classifyFatigue`, `shouldDeload`                                 |
|5 |Recommendations    |`getProgression`, `getSuggestedLoad`, `getSmartWarmup`, `getPeriodPhase`, `getSessionCount`, `getAvgTime`, `getFatigueTrend`, `getBalanceAdvisory`|
|6 |Utilities          |`playBeep`                                                                                                                                        |
|7 |PPG / HR Engine    |All signal processing: Butterworth, FFT, Welch PSD, SNR weighting, peak detection, `ppgDetect` pipeline                                           |
|8 |UI Components      |`RestTimer`, `HRMonitor`, `ProgressChart`, `ElapsedClock`, `ExerciseCard`, `LoadTargets`, `ConfirmDialog`, `SettingsSheet`                        |
|9 |Main App           |`App()` with state, helpers, 6 named screen renderers, and router                                                                                 |
|10|Mount              |`RD.createRoot(...).render(e(App))`                                                                                                               |

### Screen Renderers (inside App)

|Function                  |Screen   |Purpose                                                            |
|--------------------------|---------|-------------------------------------------------------------------|
|`renderHome()`            |Home     |Session selection, stats, collapsible insights, time selector      |
|`renderHistory()`         |History  |Session log browser with expandable detail                         |
|`renderReadinessCheckIn()`|Readiness|Pre-session check, fatigue trend advisory                          |
|`renderWarmupSelection()` |Warmup   |Warmup picker + circuit/standard mode toggle                       |
|`renderActiveWorkout()`   |Workout  |Exercise cards with suggested loads, floating timer, carry advisory|
|`renderSessionComplete()` |Complete |Summary, coached debrief, session RPE, insights, AI export, save   |

Router at the bottom of `App()`:

```
if(screen==="home"&&!showHist) return renderHome();
if(showHist) return renderHistory();
if(screen==="readiness") return renderReadinessCheckIn();
if(screen==="warmup") return renderWarmupSelection();
if(screen==="workout") return renderActiveWorkout();
if(screen==="complete") return renderSessionComplete();
return null
```

### Analytics Functions (Section 4)

|Function                            |Purpose                     |Formula/Logic                                                                     |
|------------------------------------|----------------------------|----------------------------------------------------------------------------------|
|`calcE1RM(w, r)`                    |Estimated 1-rep max         |Epley: `weight × (1 + reps/30)`                                                   |
|`getExE1RM(exId, logs)`             |e1RM trend per exercise     |Best e1RM from each logged session, last 12                                       |
|`detectPRs(exId, sets, logs)`       |Find new personal records   |Compares current sets vs all history for weight, reps-at-weight, e1RM             |
|`getGhostSets(exId, logs)`          |Last session’s sets         |Returns set array from most recent log for exercise group                         |
|`calcVolume(logs, days)`            |Volume load per exercise    |`Σ (sets × reps × weight)` within day window                                      |
|`calcTotalVolume(logs, days)`       |Total tonnage               |Sum of all exercise volumes in day window                                         |
|`calcACWR(logs)`                    |Acute:Chronic Workload Ratio|7-day volume ÷ (28-day volume / 4). >1.5 = spike risk, <0.8 = detraining          |
|`shouldDeload(logs)`                |Deload trigger              |True if RPE trending up ≥3 of last 6 sessions AND readiness declining ≥2 of last 6|
|`classifyFatigue(exercises, exData)`|Session fatigue type        |Systemic (all RPE ≥8) vs. endurance (RPE rising ≥1.5 through session)             |

### Recommendation Functions (Section 5)

|Function                                                              |Purpose                        |Logic                                                                                                                                |
|----------------------------------------------------------------------|-------------------------------|-------------------------------------------------------------------------------------------------------------------------------------|
|`getProgression(exId, logs, readiness, sessionCount)`                 |Should user increase weight?   |RPE-gated, 2-session rule. Phase-aware message flavor                                                                                |
|`getSuggestedLoad(exId, logs, readiness, sessionCount, carryAdvisory)`|What weight to start with today|Combines progression verdict + readiness + carry context into one number. Returns `{weight, reason}` or null for bodyweight exercises|
|`getSmartWarmup(sessionKey, readiness, daysSince, timeAvail)`         |Warmup suggestion              |Readiness-based selection, capped by time constraint at 15 min                                                                       |
|`getPeriodPhase(sessionCount)`                                        |Training focus label           |≤8: early / ≤20: building / ≤40: established / 41+: experienced                                                                      |
|`getSessionCount(logs)`                                               |Total non-manual sessions      |Simple count, replaces calendar-week logic                                                                                           |
|`getAvgTime(sessionKey, logs)`                                        |Average session duration       |Mean of logged durations for a session type                                                                                          |
|`getFatigueTrend(logs)`                                               |3-session fatigue advisory     |Pattern A: RPE climbing (floor 8, spread ≥1.5). Pattern B: avg RPE ≥7.5 + readiness ≤5/9                                             |
|`getBalanceAdvisory(logs, rec)`                                       |Session balance advisory       |Flags core type absent from last 9 sessions. Suppressed if rec matches                                                               |

### Screen Flow

```
Home → [Select Session] → Readiness Check-In → Warmup Selection → Workout → Completion → Home
  ↑ time avail                   |                                          ↕
  ↑ insights toggle              └─── Quick Start ──────────► Workout    History / Settings
```

### Data Model

```
cycleState: { lastSession, lastDate, isDoubleDay, completedToday[], preTgu }
logs[]: {
  date, session, warmup, duration, notes, readiness,
  sessionRPE,                                          // overall 1-10 session difficulty
  prs[{ exId, exName, setIdx, reasons[] }],            // PRs detected this session
  exercises[{ id, sets[{ weight, reps, rpe }] }]
}
lastWeights: { [exerciseId]: lastUsedWeight }
videoUrls: { [exerciseId]: youtubeUrl }
```

### localStorage Keys

|Key    |Content                       |Included in backup|
|-------|------------------------------|------------------|
|`wk-st`|Cycle state                   |Yes               |
|`wk-lg`|Session logs (max 100)        |Yes               |
|`wk-wt`|Last weights per exercise     |Yes               |
|`wk-vd`|YouTube video URLs            |Yes               |
|`wk-cr`|Carry type preference         |Yes               |
|`wk-rs`|Rest timer duration           |Yes               |
|`wk-at`|Last analysis export timestamp|Yes               |

### Data Export/Import

Export produces a JSON file containing all 7 localStorage keys plus `version` and `exportDate` metadata. Import validates: JSON parse, `logs` is array, first 3 entries have `date` and `session` fields, `state` and `weights` are objects if present. Import stages data in a confirmation dialog showing session count and export date before overwriting.

### Theme Tokens

Centralized in `var T={...}` object. New code references tokens; legacy code has hardcoded values (progressive migration).

|Token           |Key               |Value    |Usage                             |
|----------------|------------------|---------|----------------------------------|
|Page background |`T.bg`            |`#0C0A09`|Body, root, footer bars           |
|Card background |`T.card`          |`#1C1917`|Exercise cards, sheets, dialogs   |
|Input background|`T.inp`           |`#292524`|Inputs, inactive buttons          |
|Border default  |`T.brd`           |`#44403C`|Cards, buttons, inputs            |
|Border light    |`T.brdL`          |`#57534E`|Subtle borders, ghost text        |
|Text muted      |`T.mut`           |`#78716C`|Hints, timestamps                 |
|Text secondary  |`T.sec`           |`#A8A29E`|Descriptions, labels              |
|Text body       |`T.txt`           |`#E7E5E4`|Body text                         |
|Text primary    |`T.hi`            |`#F5F5F4`|Headings, active text             |
|Amber accent    |`T.acc`           |`#F59E0B`|Primary action, timer             |
|Amber light     |`T.accL`          |`#FBBF24`|Timer digits, RPE labels          |
|Green success   |`T.ok`            |`#10B981`|Completion, low RPE, ACWR on track|
|Green light     |`T.okL`           |`#6EE7B7`|Success text                      |
|Green dark      |`T.okD`           |`#166534`|Done card background              |
|Green border    |`T.okBr`          |`#22C55E`|Completion checkmarks             |
|Warning         |`T.warn`          |`#FBBF24`|Mid-range indicators              |
|Error           |`T.err`           |`#EF4444`|High RPE, injury risk, deload     |
|Error dark      |`T.errD`          |`#991B1B`|Danger zone backgrounds           |
|Error light     |`T.errL`          |`#FCA5A5`|Danger text                       |
|Pink            |`T.pk`            |`#EC4899`|HR monitor                        |
|Pink light      |`T.pkL`           |`#F9A8D4`|HR text                           |
|Pink dark       |`T.pkD`           |`#44203C`|HR borders                        |
|Session colors  |`T.A/B/C/modC/TGU`|Various  |Session-specific accents          |

-----

## Key Design Decisions

1. **Single HTML file** — No build tools, no dependencies beyond React CDN. Mitigated by 10-section refactoring
1. **No JSX** — Uses `React.createElement` directly. Verbose but zero-config
1. **localStorage only** — No server, no database. Mitigated by JSON export/import with confirmation
1. **Accordion over tabs** — Expanding cards reduce context switching
1. **RPE as safety valve** — Progression gated on RPE, not just rep targets
1. **Circuit mode as toggle, not separate flow** — Same UI, different auto-advance logic
1. **HR via camera PPG** — Experimental finger-on-lens approach during rest
1. **No haptic feedback** — iOS Safari limitation
1. **Async font loading + preconnect** — Non-blocking external resource loading
1. **Deterministic smart logic over live AI** — All analysis runs in-app. AI via structured export
1. **Floating timer over inline timer** — Sticky header pill, always visible
1. **Session RPE separate from exercise RPE** — Localized vs cumulative fatigue tracking
1. **Advisory philosophy** — All recommendations are soft advisories. Never enforcement. Manual override absolute. Wording direct and evidence-based
1. **Session-count over calendar-weeks** — Training focus keyed off session count, not time elapsed
1. **Time-available as format input only** — Shapes warmup/circuit, not session content. Per-visit state
1. **Collapsible insights over mode toggle** — Lighter than a full Minimal/Coach mode system. Groups analytical cards behind one tap, avoids creating two product personalities

-----

## Deployment

### GitHub Pages Setup

- Repository: `samholub/ABC-workout`
- Branch: `main`
- URL: `https://samholub.github.io/ABC-workout/`
- Debug tool: `https://samholub.github.io/ABC-workout/hr-debug.html`

### Updating the App

Push updated HTML files to the `main` branch. GitHub Pages auto-deploys. Can push directly via GitHub API with personal access token from iPhone.

**Critical:** When copy/pasting code on iPhone, iOS auto-corrects straight quotes to smart quotes (curly quotes), which breaks JavaScript. Always verify no smart quotes after paste.

-----

## iOS PWA Layout Rules

- The bottom safe area (home indicator, ~34px) in iOS standalone mode is **outside the web view**
- `viewport-fit=cover` grants access to the **top** safe area only
- The only reliable bottom-gap strategy is **color-matching** footer backgrounds to page background
- Web view height on iPhone with Dynamic Island: 812 CSS pixels

### Device Measurements (iPhone with Dynamic Island)

|Measurement           |Value                             |
|----------------------|----------------------------------|
|Physical screen height|874 CSS pixels                    |
|Web view viewport     |812 CSS pixels                    |
|Safe area top         |62px (status bar + Dynamic Island)|
|Safe area bottom      |34px (home indicator)             |
|Device pixel ratio    |3x                                |

-----

## HR/PPG Technical Notes

Camera-based photoplethysmography (PPG) heart rate detection. Covers both the main app’s HR spot-check component (Section 7) and the standalone debug tool (`hr-debug.html`). This feature is experimental and not actively being developed.

### Integration Target

Rest-period spot check: tap heart button during rest → hold finger on camera for 15s → app reports recovered vs still elevated. Binary decision (HR < threshold = recovered), not medical-grade. Accuracy target: ±10 BPM at least 80% of the time.

### Algorithm (V2 — Current)

SNR-weighted multi-channel approach processing five color channels (red, blue, L*, a*, b*) with 4th-order Butterworth bandpass filtering (40–200 BPM range), zero-phase filtfilt, FFT-based Welch PSD, SNR-weighted channel combination, and physiological constraint validation. Replaced V1 single-channel autocorrelation which had a half-rate harmonic selection bug (~30% accuracy → 40% of readings returned ~44 BPM instead of ~87 BPM).

### Debug Tool (`hr-debug.html`)

Standalone single-file React app (~490 lines). 6-channel recording (RGB + LAB), 4 visualization tabs (Raw Signals, Filtered, Autocorrelation, BPM Compare), adjustable duration (10/15/20/30s), CSV export.

### Key Hardware Findings

- **Ultra Wide camera preferred for PPG** — main camera’s f/1.6 aperture causes red channel saturation near 255, clipping pulse wave peaks. Ultra Wide (f/2.2, smaller sensor) keeps values in range with headroom for ~0.2–0.5% pulse modulation
- **Red, L*, a* are effectively the same signal** (r > 0.999 with finger-on-camera); green is noise; b* occasionally shows independent behavior
- **Red channel StdDev < 2.0 = signal failure** — concrete threshold for real-time quality feedback
- **Pulse oximetry not viable** — iPhone IR-cut filters block 940nm required for true SpO2

### Algorithm Improvement Workflow

1. Record 5-10 sessions with debug tool
1. Screenshot Autocorrelation and BPM Compare tabs
1. Export CSV for offline analysis if needed
1. Modify algorithm in `hr-debug.html` first (isolated from main app)
1. Re-test with another batch of recordings
1. Once reliable, fold improved algorithm into `index.html`