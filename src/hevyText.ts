import type { Exercise, Session, SessionExercise, SetLog } from './types.ts';
import { exerciseResolver, parseHevyDate, type HevyResult } from './csv.ts';
import { dayOfSession, weekNumber } from './engine.ts';
import { fmtNum } from './util.ts';

/** A workout copied as text from Hevy. start is local "YYYY-MM-DDTHH:mm", empty if the text didn't include a readable date. */
export interface PastedWorkout {
  title: string;
  start: string;
  minutes: number;
  exercises: SessionExercise[];
  warmups: string[]; // sets guessed to be warm-ups, for the preview
  warnings: string[];
  legacy: HevyResult['legacy'];
}

const n2 = (v: number) => String(v).padStart(2, '0');
const localStart = (d: Date) => `${d.getFullYear()}-${n2(d.getMonth() + 1)}-${n2(d.getDate())}T${n2(d.getHours())}:${n2(d.getMinutes())}`;

/** "Oct 28, 2026, 7:12 PM", "Yesterday at 6:03 PM" or "Today at 18:03". */
function readStart(line: string, now: Date): string {
  const rel = line.match(/^(today|yesterday)(?:\s+at)?,?\s+(\d{1,2}):(\d{2})\s*([ap]m)?$/i);
  if (rel) {
    let hour = Number(rel[2]);
    if (rel[4]) { hour %= 12; if (rel[4].toLowerCase() === 'pm') hour += 12; }
    const back = rel[1].toLowerCase() === 'yesterday' ? 1 : 0;
    return localStart(new Date(now.getFullYear(), now.getMonth(), now.getDate() - back, hour, Number(rel[3])));
  }
  try { return localStart(new Date(parseHevyDate(line))); } catch { return ''; }
}

const readMinutes = (line: string) => {
  const m = line.match(/^(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
  return Number(m?.[1] ?? 0) * 60 + Number(m?.[2] ?? 0);
};
/** "6,082 kg", "3,915.5 kg" or "6.082 kg" */
const readVolume = (line: string | undefined) => {
  const m = line?.match(/^([\d.,]+)\s*kg$/i);
  return m ? Number(m[1].replace(/[.,](?=\d{3}\b)/g, '').replace(',', '.')) : null;
};
function readSet(line: string): Pick<SetLog, 'weightKg' | 'reps'> | null {
  const loaded = line.match(/^[+-]?([\d.,]+)\s*kg\s*[x×]\s*(\d+)\s*reps?$/i);
  if (loaded) return { weightKg: Number(loaded[1].replace(',', '.')), reps: Number(loaded[2]) };
  const bare = line.match(/^(\d+)\s*reps?$/i);
  return bare ? { weightKg: null, reps: Number(bare[1]) } : null;
}

// the text doesn't mark warm-ups, so opening sets well below the exercise's heaviest count as warm-ups
const WARMUP_BELOW = 0.7;
function markWarmups(sets: SetLog[]) {
  const top = Math.max(0, ...sets.map((s) => s.weightKg ?? 0));
  for (const s of sets) {
    if (!top || s.weightKg == null || s.weightKg > top * WARMUP_BELOW) break;
    s.type = 'warmup';
  }
}

const isWord = (line: string | undefined, word: string) => line?.toLowerCase() === word;

/**
 * Reads Hevy's shared workout text. Each workout runs: [user, date,] title, "Duration", time,
 * "Volume", total, "Records", counts, then for each exercise: name, "SETS", a column heading, sets.
 * Badges such as "Best Volume" sit between sets.
 */
export function parseHevyText(text: string, now = new Date(), known?: Exercise[]): PastedWorkout[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const anchors = lines.flatMap((l, i) => (i > 0 && isWord(l, 'duration') ? [i] : []));
  return anchors.map((at, a) => {
    const { idFor, legacy } = exerciseResolver(known);
    const start = at >= 2 ? readStart(lines[at - 2], now) : '';
    // stop before the next workout's title, and its user and date lines if it has them
    let end = lines.length;
    if (a + 1 < anchors.length) {
      end = anchors[a + 1] - 1;
      if (readStart(lines[end - 1] ?? '', now)) end -= 2;
    }
    const exercises: SessionExercise[] = [];
    const warnings: string[] = [];
    const names = new Map<string, string>();
    let cur: SessionExercise | undefined;
    for (let i = at + 2; i < end; i++) {
      if (isWord(lines[i + 1], 'sets')) {
        const id = idFor(lines[i]);
        names.set(id, lines[i]);
        cur = exercises.find((e) => e.exerciseId === id);
        if (!cur) { cur = { exerciseId: id, sets: [] }; exercises.push(cur); }
        i += 2; // past "SETS" and the column heading
      } else if (cur && !/^best\b/i.test(lines[i])) {
        const set = readSet(lines[i]);
        if (set) cur.sets.push({ index: cur.sets.length, type: 'working', ...set });
        else warnings.push(`Not read: ${lines[i]}`);
      }
    }
    const warmups: string[] = [];
    for (const e of exercises) {
      markWarmups(e.sets);
      for (const s of e.sets) if (s.type === 'warmup') warmups.push(`${names.get(e.exerciseId)} ${fmtNum(s.weightKg ?? 0)}×${s.reps}`);
    }
    const volumeAt = lines.slice(at, end).findIndex((l) => isWord(l, 'volume'));
    const stated = volumeAt >= 0 ? readVolume(lines[at + volumeAt + 1]) : null;
    const total = exercises.flatMap((e) => e.sets).reduce((v, s) => v + (s.weightKg ?? 0) * (s.reps ?? 0), 0);
    if (stated != null && Math.abs(stated - total) > 1) warnings.push(`Sets add up to ${fmtNum(total)} kg, Hevy says ${fmtNum(stated)} kg`);
    if (!exercises.length) warnings.push('No exercises found');
    return { title: lines[at - 1], start, minutes: readMinutes(lines[at + 1] ?? ''), exercises, warmups, warnings, legacy: [...legacy.values()] };
  });
}

export function pastedSession(w: PastedWorkout, blockStart: string): Session {
  const startedAt = new Date(w.start || Date.now());
  return {
    id: `hevy:${w.start}`, title: w.title, weekNumber: weekNumber(startedAt, blockStart), source: 'hevy_import',
    startedAt: startedAt.toISOString(), endedAt: new Date(startedAt.getTime() + w.minutes * 60000).toISOString(), exercises: w.exercises,
  };
}
export function pastedResult(workouts: PastedWorkout[], blockStart: string): HevyResult {
  const legacy = new Map(workouts.flatMap((w) => w.legacy).map((l) => [l.id, l]));
  return { sessions: workouts.map((w) => pastedSession(w, blockStart)), legacy: [...legacy.values()] };
}

/**
 * Saved sessions a pasted one replaces: the same program day on the same date under another start
 * time, such as one whose time was approximate. Sessions edited here are kept.
 */
export function replacedBy(existing: Session[], incoming: Session[]) {
  const key = (s: Session) => `${new Date(s.startedAt).toDateString()}|${dayOfSession(s)}`;
  const ids = new Set(incoming.map((s) => s.id));
  const keys = new Set(incoming.filter(dayOfSession).map(key));
  return existing.filter((old) => !old.edited && !ids.has(old.id) && keys.has(key(old)));
}
