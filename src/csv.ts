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
/** Hevy's date format follows the phone's locale: "Oct 23, 2026, 10:27 AM" or "23 Oct 2026, 22:27". */
function parseHevyParts(s: string) {
  const t = s.trim();
  const us = t.match(/^([a-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  const eu = t.match(/^(\d{1,2})\s+([a-z]{3})[a-z]*\.?,?\s+(\d{4}),?\s+(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  const m = us ?? eu;
  const month = m ? MONTHS.indexOf((us ? m[1] : m[2]).toLowerCase()) : -1;
  if (!m || month < 0) throw new Error(`Unrecognised date: ${s}`);
  let hour = Number(m[4]);
  if (m[6]) { hour %= 12; if (m[6].toLowerCase() === 'pm') hour += 12; }
  return { year: Number(m[3]), month, day: Number(us ? m[2] : m[1]), hour, minute: Number(m[5]) };
}
/** Hevy time, read as local time -> ISO string */
export function parseHevyDate(s: string): string {
  const p = parseHevyParts(s);
  return new Date(p.year, p.month, p.day, p.hour, p.minute).toISOString();
}
/**
 * A session's identity is when it started, as written in the export. It survives renaming the
 * workout in Hevy, a change of phone language, and importing on a device in another time zone.
 */
export function hevySessionId(start: string): string {
  const p = parseHevyParts(start);
  const n = (v: number) => String(v).padStart(2, '0');
  return `hevy:${p.year}-${n(p.month + 1)}-${n(p.day)}T${n(p.hour)}:${n(p.minute)}`;
}
/** Sessions saved by older versions used `hevy:<title>|<start_time>` as their id. */
export function migrateSessionId(id: string): string {
  const bar = id.lastIndexOf('|');
  if (!id.startsWith('hevy:') || bar < 0) return id;
  try { return hevySessionId(id.slice(bar + 1)); } catch { return id; }
}

const finite = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
/** Exercises that became one: seated and standing lateral raises are now logged as the same exercise. */
const MERGED: Record<string, string> = { 'seated-db-lateral-raise': 'db-lateral-raise' };
/**
 * Brings saved sessions to the current shape; safe to run on every start and after a restore.
 * Migrates old ids, merges the duplicates old ids allowed, clears non-numeric values, and drops
 * hand-seeded sessions (history comes only from Hevy imports).
 */
export function normalizeSessions(sessions: Session[]): Session[] {
  const out = new Map<string, Session>();
  for (const s of sessions) {
    if (s.source === 'seed' || s.source === 'app') continue;
    const clean: Session = {
      ...s,
      id: migrateSessionId(s.id),
      exercises: s.exercises.map((e) => ({
        ...e,
        exerciseId: MERGED[e.exerciseId] ?? e.exerciseId,
        sets: e.sets.map((x) => {
          const { rpe, ...set } = x;
          const r = finite(rpe);
          return { ...set, weightKg: finite(x.weightKg), reps: finite(x.reps), ...(r != null ? { rpe: r } : {}) };
        }),
      })),
    };
    const twin = out.get(clean.id);
    if (!twin || (clean.edited && !twin.edited)) out.set(clean.id, clean);
  }
  return [...out.values()];
}

export interface ImportPlan {
  add: Session[];
  update: Session[];
  keptEdited: number; // changed in Hevy, but edited here too: the edit in the app wins
  missing: Session[]; // inside the export's date range but no longer in it (deleted or re-timed in Hevy)
}
const content = (s: Session) => JSON.stringify([s.title, s.endedAt, s.remark, s.exercises]);
export function planImport(existing: Session[], incoming: Session[]): ImportPlan {
  const byId = new Map(existing.map((s) => [s.id, s]));
  const plan: ImportPlan = { add: [], update: [], keptEdited: 0, missing: [] };
  for (const s of incoming) {
    const old = byId.get(s.id);
    if (!old) plan.add.push(s);
    else if (content(old) === content(s)) continue;
    else if (old.edited) plan.keptEdited++;
    else plan.update.push(s);
  }
  if (incoming.length) {
    const ids = new Set(incoming.map((s) => s.id));
    const times = incoming.map((s) => s.startedAt).sort();
    plan.missing = existing.filter((s) => s.source === 'hevy_import' && !ids.has(s.id)
      && s.startedAt >= times[0] && s.startedAt <= times[times.length - 1]);
  }
  return plan;
}

const SET_TYPES: Record<string, SetType> = { normal: 'working', warmup: 'warmup', failure: 'failure', dropset: 'drop' };
const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const guessType = (t: string): ExerciseType =>
  /press|row|squat|deadlift|pull|dip/i.test(t) && !/fly|raise|curl|extension/i.test(t) ? 'compound' : 'isolation';

export interface HevyResult { sessions: Session[]; legacy: { id: string; name: string; type: ExerciseType }[] }

/** Maps Hevy exercise names to library ids. Names it doesn't know become legacy exercises. */
export function exerciseResolver(known: Exercise[] = LIBRARY) {
  const byName = new Map<string, string>();
  // the app's own name also maps, so a custom Hevy exercise named the same way imports correctly
  for (const e of known) for (const n of [e.name, ...e.hevyNames]) byName.set(n.toLowerCase(), e.id);
  const legacy = new Map<string, { id: string; name: string; type: ExerciseType }>();
  const idFor = (name: string) => {
    const id = byName.get(name.toLowerCase());
    if (id) return id;
    const made = `legacy-${slug(name)}`;
    if (!legacy.has(made)) legacy.set(made, { id: made, name, type: guessType(name) });
    return made;
  };
  return { idFor, legacy };
}

export function parseHevy(text: string, blockStart: string, known: Exercise[] = LIBRARY): HevyResult {
  const rows = parseCsv(text);
  const head = (rows.shift() ?? []).map((h) => h.trim());
  const absent = ['title', 'start_time', 'exercise_title', 'set_type', 'weight_kg', 'reps'].filter((c) => !head.includes(c));
  if (absent.length) throw new Error(`Not a Hevy export (missing ${absent.join(', ')})`);
  const col = (r: string[], name: string) => r[head.indexOf(name)]?.trim() ?? '';
  const { idFor, legacy } = exerciseResolver(known);
  const sessions = new Map<string, Session>();

  for (const r of rows) {
    const title = col(r, 'title'), start = col(r, 'start_time');
    const key = hevySessionId(start);
    let s = sessions.get(key);
    if (!s) {
      const startedAt = parseHevyDate(start);
      const end = col(r, 'end_time');
      s = { id: key, title, weekNumber: weekNumber(new Date(startedAt), blockStart), startedAt, endedAt: end ? parseHevyDate(end) : startedAt, source: 'hevy_import', remark: col(r, 'description') || undefined, exercises: [] };
      sessions.set(key, s);
    }
    const id = idFor(col(r, 'exercise_title'));
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
