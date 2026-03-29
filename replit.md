# ABC Workout PWA

## Overview
A single-file Progressive Web App (PWA) for tracking the ABC training program — a workout routine based on asymmetric, multi-planar movements with RPE-based autoregulation.

## Tech Stack
- **Frontend:** React 18.2.0 (loaded via CDN — no build step required)
- **Language:** Vanilla JavaScript (no JSX, no transpiler)
- **Styling:** Inline CSS with centralized theme tokens
- **Storage:** localStorage (no backend or database)
- **PWA:** Manifest + Apple-specific meta tags for mobile installation

## Project Structure
- `index.html` — The entire application (single file)
- `hr-debug.html` — Standalone diagnostic tool for PPG heart rate algorithm
- `ARCHITECTURE.md` — Technical reference and design decisions
- `ARCHITECTURE_REVIEW.md` — Detailed architecture review
- `CURRENT_STATE.md` — Version info and current feature set
- `ROADMAP.md` — Planned features
- `CHANGELOG.md` — History of updates
- `TESTING.md` — Testing procedures

## localStorage Keys
| Key | Content |
|-----|---------|
| `wk-st` | Cycle state |
| `wk-lg` | Session logs (max 100) |
| `wk-wt` | Last weights per exercise |
| `wk-vd` | YouTube video URLs |
| `wk-cr` | Carry type preference |
| `wk-rs` | Rest timer duration |
| `wk-at` | Last analysis export timestamp |
| `wk-draft` | In-progress workout draft (survives tab eviction) |

## Draft Session Persistence (P0-1)
Protects against iOS Safari tab eviction during active workouts:
- Draft written to `wk-draft` on session start
- Auto-saved every 5 seconds while on the workout screen
- Cleaned up on save (saveAndFinish), cancel (home), and full reset (clearAll)
- On app mount, checks for existing draft and shows recovery banner on home screen
- Resume validates and normalizes exercise data structure before restoring state

## Development
No build step required. The app is served as a static file.

**Workflow:** `Start application` runs `python3 -m http.server 5000 --bind 0.0.0.0`

## Deployment
Configured as a **static** deployment with `publicDir: "."`.
