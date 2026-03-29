# ABC Workout PWA — Testing

Field validation steps, regression checklist, and known platform limitations. Updated when features ship or bugs surface.

-----

## Regression Checklist

Run after any code change before deploying. All tests performed on iPhone via iOS Safari / PWA standalone mode.

### Core Workflow

|Step                                 |Expected                                                      |
|-------------------------------------|--------------------------------------------------------------|
|Cold load (clear cache)              |App loads in <2s, fonts render, no FOUC                       |
|Select recommended session           |Correct session highlighted, reason line visible              |
|Complete readiness check-in          |3 taps → score displayed → warmup screen                      |
|Select warmup → start workout        |Exercise cards render with correct exercises for session type |
|Log a set (weight/reps/RPE)          |Set saved, auto-advance to next set, rest timer starts        |
|Complete all sets → completion screen|Summary card, coached debrief, session RPE selector all render|
|Save & Done                          |Returns to home, cycle advances, session appears in history   |

### Feature-Specific

|Feature                 |Validation                                                                                               |
|------------------------|---------------------------------------------------------------------------------------------------------|
|Progression badge       |Collapsed card shows green “⬆ READY” when criteria met (2 sessions at target reps + RPE ≤ threshold)     |
|Suggested load          |“Start: N lbs” visible on collapsed/expanded cards. Green = increase, amber = hold. Null for bodyweight  |
|Ghost sets              |Previous session’s sets shown in muted text on expanded card                                             |
|PR detection            |New weight/reps-at-weight/e1RM PR triggers banner on completion screen                                   |
|Rest timer              |Countdown starts on set completion. Pause/resume/skip work. Audio beep at zero                           |
|Circuit mode            |Toggle works on warmup screen. Auto-advance rotates exercises instead of completing all sets per exercise|
|Collapsible insights    |“Insights ▲/▼” toggle on home screen. Cards group/ungroup. Default open                                  |
|Coached debrief         |Completion screen shows per-exercise action items + next session recommendation                          |
|Fatigue trend           |Readiness screen shows advisory when 3-session RPE pattern detected                                      |
|Balance advisory        |Home screen flags missing session type from last 9 sessions                                              |
|Double-day carry warning|Banner + OPTIONAL badge appear on carry cards after A+B same day                                         |
|Time-available          |3-option selector on home. 10–15 min caps warmup, pre-selects circuit                                    |
|Data export             |JSON file downloads with all 7 localStorage keys + metadata                                              |
|Data import             |Confirmation dialog shows session count + date. Validates structure before overwriting                   |
|Manual log entry        |History screen → add manual entry → appears in log with correct date                                     |
|Progression charts      |Tapping chart icon shows SVG weight-over-time with RPE-colored dots                                      |

### Layout & PWA

|Check              |Expected                                                                |
|-------------------|------------------------------------------------------------------------|
|PWA standalone mode|No browser chrome, status bar tinted, no bottom gap                     |
|Bottom safe area   |Footer background matches page background — no white/black strip        |
|Scroll behavior    |No horizontal scroll. Vertical scroll only within content areas         |
|Font loading       |Google Fonts load non-blocking. Fallback font visible briefly, then swap|

-----

## Known Platform Limitations

|Limitation                        |Detail                                                       |Workaround                                            |
|----------------------------------|-------------------------------------------------------------|------------------------------------------------------|
|No haptic feedback                |iOS Safari does not support Vibration API                    |None — audio cue used for rest timer instead          |
|Smart quote corruption            |iOS auto-corrects `'` and `"` to curly quotes when pasting JS|Verify no smart quotes after paste before deploying   |
|AudioContext requires user gesture|iOS Safari blocks `AudioContext` creation until first tap    |Rest timer beep initializes on first user interaction |
|HR camera selection               |`facingMode` unreliable in iOS standalone PWA mode           |Debug tool selects rear camera by `deviceId`          |
|No service worker                 |App requires network for first load                          |Planned for future (see ROADMAP)                      |
|localStorage limits               |~5MB per origin on iOS Safari                                |Log capped at 100 sessions; export/import for archival|

-----

## Test Notes

- All testing is real-device on iPhone with Dynamic Island (iOS Safari + PWA standalone)
- No emulator or desktop browser testing — iOS-specific layout and API behavior is the ground truth
- Preconnect hints (`fonts.googleapis.com`, `fonts.gstatic.com`, `cdnjs.cloudflare.com`) verified to reduce cold-load time
- When testing HR, use debug tool (`hr-debug.html`) first to isolate signal issues from app integration issues