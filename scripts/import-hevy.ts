// Usage: npm run import:hevy -- data/workouts.csv
// Converts a Hevy CSV export into src/seed/hevy.json (loaded automatically on first run).
import fs from 'node:fs';
import { parseHevy } from '../src/csv.ts';

const file = process.argv[2];
if (!file) { console.error('Usage: npm run import:hevy -- <workouts.csv>'); process.exit(1); }
const res = parseHevy(fs.readFileSync(file, 'utf8'), '2026-10-26');
fs.writeFileSync('src/seed/hevy.json', JSON.stringify(res, null, 1));
console.log(`Wrote src/seed/hevy.json: ${res.sessions.length} sessions, ${res.legacy.length} legacy exercises`);
