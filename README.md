# Gym Tracker

Minimal mobile-first PWA for my Upper A / Lower / Upper B program. React + TypeScript + Dexie (IndexedDB), no backend. Data lives on the device; use Settings → Export JSON to back up.

```bash
npm install
npm run dev      # local dev server
npm test         # progression engine + rotation tests
npm run build    # static site in dist/
```

## Deploy (free, GitHub Pages)

1. Push this repo to GitHub (branch `main`).
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. The included workflow (`.github/workflows/deploy.yml`) tests, builds and publishes on every push.
4. Open the Pages URL on your phone and use "Add to Home screen" / "Install".

Any static host works too (Netlify, Cloudflare Pages): build command `npm run build`, publish directory `dist`. The build uses relative paths, so it works under `/<repo>/`.

## Importing Hevy history

- In the app: Settings → Import Hevy CSV (safe to repeat; existing sessions are skipped).
- Or bake it into first run: put the export at `data/workouts.csv`, run `npm run import:hevy -- data/workouts.csv`, which writes `src/seed/hevy.json`.

Known issues in the export (import as-is, fix in History by tapping a set): 2 Oct 2026 calf raise "13 kg" (should be 130), 29 Jul 2026 machine shoulder press weight/reps swapped.

## Layout

- `src/engine.ts` – pure progression, rotation, review and volume logic (tested in `engine.test.ts`)
- `src/seed/` – exercise library, program slots, week-1 data
- `src/screens/` – Today, session, History, Program, Exercises, Progress, Settings
