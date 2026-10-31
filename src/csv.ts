import type { Exercise, ExerciseType, Session, SessionExercise, SetLog, SetType } from './types.ts';
import { LIBRARY } from './seed/library.ts';
import { weekNumber } from './engine.ts';

export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') q = false;
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ',') { row.push(cell); cell = ''; }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell); cell = '';
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
    } else cell += c;
  }
  row.push(cell);
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** "Oct 23, 2026, 10:27 AM" in local time -> ISO string */
export function parseHevyDate(s: string): string {
  const m = s.trim().match(/^(\w{3})\w*\s+(\d{1,2}),\s*(\d{4}),?\s+(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!m) throw new Error(`Unrecognised date: ${s}`);
  let h = Number(m[4]);
  if (m[6]) { h %= 12; if (m[6].toUpperCase() === 'PM') h += 12; }
  return new Date(Number(m[3]), MONTHS.indexOf(m[1].toLowerCase()), Number(m[2]), h, Number(m[5])).toISOString();
}

const SET_TYPES: Record<string, SetType> = { normal: 'working', warmup: 'warmup', failure: 'failure', dropset: 'drop' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const guessType = (t: string): ExerciseType =>
  /press|row|squat|deadlift|pull|dip/i.test(t) && !/fly|raise|curl|extension/i.test(t) ? 'compound' : 'isolation';

export interface HevyResult { sessions: Session[]; legacy: { id: string; name: string; type: ExerciseType }[] }

export function parseHevy(text: string, blockStart: string, known: Exercise[] = LIBRARY): HevyResult {
  const rows = parseCsv(text);
  const head = rows.shift()!.map((h) => h.trim());
  const col = (r: string[], name: string) => r[head.indexOf(name)]?.trim() ?? '';
  const byName = new Map<string, string>();
  for (const e of known) for (const n of e.hevyNames) byName.set(n.toLowerCase(), e.id);
  const legacy = new Map<string, { id: string; name: string; type: ExerciseType }>();
  const sessions = new Map<string, Session>();

  for (const r of rows) {
    const title = col(r, 'title'), start = col(r, 'start_time');
    const key = `hevy:${title}|${start}`;
    let s = sessions.get(key);
    if (!s) {
      const startedAt = parseHevyDate(start);
      const end = col(r, 'end_time');
      s = { id: key, title, weekNumber: weekNumber(new Date(startedAt), blockStart), startedAt, endedAt: end ? parseHevyDate(end) : startedAt, source: 'hevy_import', remark: col(r, 'description') || undefined, exercises: [] };
      sessions.set(key, s);
    }
    const name = col(r, 'exercise_title');
    let id = byName.get(name.toLowerCase());
    if (!id) {
      id = `legacy-${slug(name)}`;
      if (!legacy.has(id)) legacy.set(id, { id, name, type: guessType(name) });
    }
    let se: SessionExercise | undefined = s.exercises.find((e) => e.exerciseId === id);
    if (!se) {
      se = { exerciseId: id, sets: [], note: col(r, 'exercise_notes') || undefined };
      s.exercises.push(se);
    }
    const num = (v: string) => (v === '' || isNaN(Number(v)) ? null : Number(v));
    const set: SetLog = { index: se.sets.length, type: SET_TYPES[col(r, 'set_type')] ?? 'working', weightKg: num(col(r, 'weight_kg')), reps: num(col(r, 'reps')) };
    const rpe = num(col(r, 'rpe'));
    if (rpe != null) set.rpe = rpe;
    se.sets.push(set);
  }
  return { sessions: [...sessions.values()], legacy: [...legacy.values()] };
}
