# Gym Tracker

Minimal mobile PWA to look over my Upper A / Lower / Upper B program, choose the rotating exercises each week, and review history. Workouts are logged in Hevy; each week I import the Hevy CSV export here. No backend: data lives on the device (Settings → Export JSON to back up).

- **Program** – opens on this week, with earlier weeks one tap back. Each split shows suggested and previous weight, reps, RPE and rest per exercise. Rotating slots list their options; lock one for the week, then enter that workout in Hevy. Also a rotation calendar (next 6 weeks) and rotation history (what was actually done each week).
- **History** – this week plus earlier weeks with imported data (never future weeks): sessions, auto review with next target, week remarks, hard sets per muscle, "Copy week summary".
- **Exercises** – library with how-to, notes, PRs and e1RM chart.

```bash
npm install
npm run dev      # local dev server
npm test         # progression / rotation tests
npm run build    # static site in dist/
```

## Weekly routine

Hevy → Settings → Export workout data (CSV) → open the app → History → **Import Hevy CSV**. Re-importing the full export is safe; sessions already imported are skipped.

## Deploy (GitHub Pages)

Push to `main`; `.github/workflows/deploy.yml` tests, builds and publishes. Repo → Settings → Pages → Source: GitHub Actions. Any static host works (build `npm run build`, publish `dist`).

Known issues in the old export (fix in History by tapping a set): 2 Oct 2026 calf raise "13 kg" (should be 130), 29 Jul 2026 machine shoulder press weight/reps swapped.
