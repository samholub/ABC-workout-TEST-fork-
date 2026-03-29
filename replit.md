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
- `CURRENT_STATE.md` — Version info and current feature set
- `ROADMAP.md` — Planned features
- `CHANGELOG.md` — History of updates
- `TESTING.md` — Testing procedures

## Development
No build step required. The app is served as a static file.

**Workflow:** `Start application` runs `python3 -m http.server 5000 --bind 0.0.0.0`

## Deployment
Configured as a **static** deployment with `publicDir: "."`.
