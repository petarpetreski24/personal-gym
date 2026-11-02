import type { DayId, Equip, Exercise, Muscle, Session, SessionExercise, SetLog, Slot, Target } from './types.ts';
import { SLOTS } from './seed/program.ts';

/* ---------- weeks & rotation ---------- */
const DAY_MS = 86400000;
export const parseDate = (iso: string) => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d); };
export function mondayOf(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return x;
}
export function weekNumber(date: Date, blockStart: string) {
  const diff = Math.round((mondayOf(date).getTime() - mondayOf(parseDate(blockStart)).getTime()) / DAY_MS);
  return Math.floor(diff / 7) + 1;
}
export function weekRange(week: number, blockStart: string) {
  const start = mondayOf(parseDate(blockStart));
  start.setDate(start.getDate() + (week - 1) * 7);
  const end = new Date(start); end.setDate(end.getDate() + 6);
  return { start, end };
}
export type Variant = 'A' | 'B' | 'C';
export const variantForWeek = (week: number): Variant => (week <= 0 ? 'A' : (['A', 'B', 'C'] as const)[(week - 1) % 3]);

/** This week's variant for a rotating slot, skipping variants whose equipment is unavailable. */
export function pickVariant(slot: Slot, week: number, equip: Equip, getEx: (id: string) => Exercise) {
  const v = variantForWeek(week);
  for (const c of [v, 'A', 'B'] as Variant[]) {
    const id = slot.variants![c];
    const eq = getEx(id).equipment;
    if (!eq || !equip.unavailable.includes(eq)) return { variant: c, exerciseId: id };
  }
  return { variant: v, exerciseId: slot.variants![v] };
}

/* ---------- helpers ---------- */
const r2 = (n: number) => Math.round(n * 100) / 100;
export const e1rm = (w: number, reps: number) => w * (1 + reps / 30);
export const workingSets = (s: SetLog[]) => s.filter((x) => x.type !== 'warmup' && x.reps != null && x.reps > 0);
const wt = (s: SetLog) => s.weightKg ?? 0;
const inverted = (ex: Exercise) => ex.id === 'assisted-pull-up'; // weight = assistance, lower is harder

function stepOf(ex: Exercise, eq: Equip) {
  return ex.loadType === 'cable' ? eq.cableStep : eq.barStep;
}
/** w moved one increment towards "harder" (or easier when dir = -1). */
export function stepLoad(w: number, ex: Exercise, eq: Equip, dir: 1 | -1 = 1) {
  const sign = inverted(ex) ? -dir : dir;
  if (ex.loadType === 'dumbbell') {
    const list = [...eq.dumbbells].sort((a, b) => a - b);
    if (sign > 0) return list.find((d) => d > w + 1e-9) ?? r2(w + 2.5);
    return [...list].reverse().find((d) => d < w - 1e-9) ?? Math.max(0, w - 2.5);
  }
  return Math.max(0, r2(w + sign * stepOf(ex, eq)));
}
export function roundDown(w: number, ex: Exercise, eq: Equip) {
  if (ex.loadType === 'dumbbell') {
    const list = [...eq.dumbbells].sort((a, b) => a - b);
    return [...list].reverse().find((d) => d <= w + 1e-9) ?? list[0];
  }
  const s = stepOf(ex, eq);
  return r2(Math.floor(w / s + 1e-9) * s);
}

/* ---------- next target ---------- */
export interface TargetInput {
  ex: Exercise;
  slot: Pick<Slot, 'sets' | 'repMin' | 'repMax' | 'lockedLoadKg' | 'lowerBody'>;
  history: SetLog[][]; // previous sessions of this exercise, newest first
  equip: Equip;
}

function baseWeight(sets: SetLog[], repMin: number, inv: boolean) {
  const ws = [...new Set(sets.map(wt))].sort((a, b) => (inv ? a - b : b - a));
  const base = ws.find((w) => {
    const at = sets.filter((s) => wt(s) === w);
    return at.filter((s) => s.reps! >= repMin).length * 2 >= at.length;
  });
  return { ws, base };
}

export function nextTarget({ ex, slot, history, equip }: TargetInput): Target {
  const { repMin, repMax } = slot;
  const n = slot.sets;
  const inv = inverted(ex);
  const hist = history.map(workingSets).filter((h) => h.length);
  const mid = Math.round((repMin + repMax) / 2);
  if (!hist.length) {
    return { weightKg: null, repGoals: Array(n).fill(mid), flags: ['calibrate'], reason: `First time: pick a load you can do about ${mid} reps` };
  }
  const last = hist[0];
  const flags: string[] = [];
  if (ex.loadType !== 'bodyweight' && !inv && !last.some((s) => wt(s) > 0)) {
    return { weightKg: null, repGoals: Array(n).fill(repMin), flags: ['tooLight'], reason: 'Add load' };
  }

  let { ws, base } = baseWeight(last, repMin, inv);
  if (ws.length > 1) flags.push('pyramid');
  if (base === undefined) {
    const lightest = inv ? ws[0] : ws[ws.length - 1];
    base = inv ? stepLoad(lightest, ex, equip, -1) : roundDown(lightest * 0.9, ex, equip);
  }

  const goalsFor = (w: number) => {
    const at = last.filter((s) => wt(s) === w).map((s) => s.reps!);
    const src = at.length ? at : last.map((s) => s.reps!);
    const lowest = Math.min(...src);
    return Array.from({ length: n }, (_, i) =>
      Math.min(repMax, Math.max(repMin, (i < src.length ? src[i] : lowest) + 1)));
  };

  if (slot.lockedLoadKg != null) {
    if (last.some((s) => wt(s) > slot.lockedLoadKg!)) flags.push('overCap');
    return { weightKg: slot.lockedLoadKg, repGoals: goalsFor(slot.lockedLoadKg), flags, reason: `Load locked at ${slot.lockedLoadKg} kg${flags.includes('overCap') ? ' (last time went above it)' : ''}` };
  }

  // too light
  if (last.every((s) => s.reps! >= repMax + 3)) {
    if (ex.loadType === 'bodyweight') return { weightKg: null, repGoals: Array(n).fill(repMin), flags: [...flags, 'tooLight'], reason: 'Add load' };
    const up = stepLoad(stepLoad(base, ex, equip), ex, equip);
    return { weightKg: up, repGoals: Array(n).fill(repMin), flags: [...flags, 'tooLight'], reason: `All sets ≥ ${repMax + 3} reps → +2 steps` };
  }

  const atBase = last.filter((s) => wt(s) === base);
  const hitTop = (h: SetLog[], w: number) => { const a = h.filter((s) => wt(s) === w); return a.length >= n && a.every((s) => s.reps! >= repMax); };

  // hit the top
  if (hitTop(last, base)) {
    let ok = true;
    if (slot.lowerBody) {
      const lastRpe = atBase[atBase.length - 1].rpe;
      ok = lastRpe != null ? lastRpe <= 7 : !!hist[1] && hitTop(hist[1], base);
    }
    if (ok) {
      const up = stepLoad(base, ex, equip);
      if (ex.loadType === 'bodyweight') return { weightKg: null, repGoals: Array(n).fill(repMin), flags, reason: 'Top of range → add load' };
      return { weightKg: up, repGoals: Array(n).fill(repMin), flags, reason: `All sets hit ${repMax} last time → ${inv ? '−' : '+'}${r2(Math.abs(up - base))} kg` };
    }
  }

  // below range twice
  const below = (h: SetLog[]) => h.some((s) => wt(s) === base && s.reps! < repMin);
  if (hist[1] && baseWeight(hist[1], repMin, inv).ws.includes(base) && below(last) && below(hist[1])
    && (baseWeight(hist[1], repMin, inv).base ?? base) === base) {
    const cut = inv ? stepLoad(r2(base * 1.1), ex, equip, -1) : roundDown(base * 0.9, ex, equip);
    return { weightKg: cut, repGoals: Array(n).fill(repMin), flags, reason: 'Below the range twice at this load → −10%' };
  }

  const g = goalsFor(base);
  return { weightKg: base, repGoals: g, flags, reason: `Last: ${atBase.map((s) => s.reps).join(', ')} at ${base} kg → add a rep per set` };
}

/* ---------- history lookup ---------- */
const byStart = (a: Session, b: Session) => a.startedAt.localeCompare(b.startedAt);
export const finished = (sessions: Session[]) => sessions.filter((s) => s.endedAt).sort(byStart);

/** The program day of a session: its dayId, or read from a Hevy title such as "Upper A". */
export function dayOfSession(s: Session): DayId | undefined {
  if (s.dayId) return s.dayId;
  const upper = s.title.match(/\bupper\s*([abc])\b/i);
  if (upper) return `upper${upper[1].toUpperCase()}` as DayId;
  return /\blower\b/i.test(s.title) ? 'lower' : undefined;
}
const slotUses = (slot: Slot, exerciseId: string) => slot.exerciseId === exerciseId || Object.values(slot.variants ?? {}).includes(exerciseId);
/** Done on a day whose slots don't include it (e.g. a cable row on Upper B). Unknown days count as on plan. */
function offPlan(s: Session, entry: SessionExercise) {
  if (entry.extra) return true;
  const day = dayOfSession(s);
  return !!day && !SLOTS.some((slot) => slot.dayId === day && slotUses(slot, entry.exerciseId));
}

/** Past entries of an exercise, newest first. forTarget excludes extras (outside the plan). */
export function entriesFor(exerciseId: string, sessions: Session[], opts: { forTarget?: boolean; excludeId?: string } = {}) {
  const out: { session: Session; entry: SessionExercise }[] = [];
  for (const s of finished(sessions).reverse()) {
    if (s.id === opts.excludeId) continue;
    for (const entry of s.exercises) {
      if (entry.exerciseId !== exerciseId) continue;
      if (opts.forTarget && offPlan(s, entry)) continue;
      if (workingSets(entry.sets).length) out.push({ session: s, entry });
    }
  }
  return out;
}

export function targetFor(ex: Exercise, slot: TargetInput['slot'], sessions: Session[], equip: Equip, excludeId?: string): Target {
  const history = entriesFor(ex.id, sessions, { forTarget: true, excludeId }).map((e) => e.entry.sets);
  return nextTarget({ ex, slot, history, equip });
}

/** Slot-like settings for any exercise (used for review/targets outside an active session). */
export function slotFor(se: SessionExercise, getEx: (id: string) => Exercise): Pick<Slot, 'sets' | 'repMin' | 'repMax' | 'lockedLoadKg' | 'lowerBody'> {
  const byId = se.slotId ? SLOTS.find((s) => s.id === se.slotId) : undefined;
  const slot = byId ?? SLOTS.find((s) => s.exerciseId === se.exerciseId || Object.values(s.variants ?? {}).includes(se.exerciseId));
  if (slot) return slot;
  const iso = getEx(se.exerciseId).type === 'isolation';
  return { sets: 3, repMin: iso ? 10 : 8, repMax: iso ? 15 : 12 };
}

/* ---------- review ---------- */
export type Tone = 'ok' | 'warn' | 'neutral';
export interface Review { status: string; tone: Tone; text: string }

export function bestE1rm(sets: SetLog[]) {
  return Math.max(0, ...workingSets(sets).map((s) => e1rm(wt(s), s.reps!)));
}
const totalReps = (sets: SetLog[]) => workingSets(sets).reduce((a, s) => a + s.reps!, 0);

export function reviewExercise(curAll: SetLog[], prevAll: SetLog[] | undefined, ex: Exercise, slot: Pick<Slot, 'repMin' | 'repMax' | 'lockedLoadKg'>): Review {
  const cur = workingSets(curAll);
  const prev = prevAll ? workingSets(prevAll) : undefined;
  const inv = inverted(ex);
  const heavy = cur.length ? (inv ? Math.min(...cur.map(wt)) : Math.max(...cur.map(wt))) : 0;
  const atHeavy = cur.filter((s) => wt(s) === heavy);
  const distinct = new Set(cur.map(wt)).size;

  if (slot.lockedLoadKg != null && cur.some((s) => wt(s) > slot.lockedLoadKg!))
    return { status: 'Over cap', tone: 'warn', text: `Above the ${slot.lockedLoadKg} kg cap` };
  if (atHeavy.filter((s) => s.reps! < slot.repMin).length * 2 > atHeavy.length)
    return { status: 'Too heavy', tone: 'warn', text: `Heaviest sets below ${slot.repMin} reps` };
  if (cur.length && (cur.every((s) => s.reps! >= slot.repMax + 3) || (ex.loadType !== 'bodyweight' && !inv && !cur.some((s) => wt(s) > 0))))
    return { status: 'Too light', tone: 'warn', text: 'Add load' };
  if (distinct > 1)
    return { status: 'Adjust: pyramid', tone: 'warn', text: 'More than one working weight – use straight sets' };
  if (prev && prev.length) {
    const be = bestE1rm(cur), pe = bestE1rm(prev);
    const sameW = (inv ? Math.min(...prev.map(wt)) : Math.max(...prev.map(wt))) === heavy;
    if (be > pe + 1e-6 || (sameW && totalReps(cur) > totalReps(prev)))
      return { status: 'Progressing', tone: 'ok', text: 'e1RM or reps up' };
    if (pe > 0 && be < pe * 0.95) return { status: 'Regressed', tone: 'warn', text: 'e1RM down more than 5%' };
    return { status: 'On track', tone: 'ok', text: 'Within range, no regression' };
  }
  return { status: 'New', tone: 'neutral', text: 'First time' };
}

export interface ReviewRow { sessionId: string; slotId?: string; exerciseId: string; sets: SetLog[]; review: Review; next: Target }

export function weeklyReview(sessions: Session[], week: number, equip: Equip, getEx: (id: string) => Exercise): ReviewRow[] {
  const all = finished(sessions);
  const rows: ReviewRow[] = [];
  for (const s of all.filter((x) => x.weekNumber === week)) {
    for (const se of s.exercises) {
      if (!workingSets(se.sets).length) continue;
      const ex = getEx(se.exerciseId);
      const prior = all.filter((p) => p.startedAt < s.startedAt);
      const prev = entriesFor(ex.id, prior)[0]?.entry.sets;
      const slot = slotFor(se, getEx);
      const hist = entriesFor(ex.id, all.filter((p) => p.startedAt <= s.startedAt), { forTarget: true }).map((e) => e.entry.sets);
      rows.push({
        sessionId: s.id, slotId: se.slotId, exerciseId: ex.id, sets: se.sets,
        review: reviewExercise(se.sets, prev, ex, slot),
        next: nextTarget({ ex, slot, history: hist, equip }),
      });
    }
  }
  return rows;
}

export function sessionFlags(s: Session, getEx: (id: string) => Exercise): string[] {
  const out: string[] = [];
  if (s.endedAt) {
    const mins = (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000;
    if (mins > 65) out.push(`Long session: ${Math.round(mins)} min`);
  }
  for (const e of s.exercises) {
    const done = workingSets(e.sets).length;
    if (e.slotId && !done) out.push(`Skipped: ${getEx(e.exerciseId).name}`);
    else if (!e.slotId && done && s.dayId) out.push(`Extra exercise: ${getEx(e.exerciseId).name}`);
    if (e.swapReason === 'discomfort') out.push(`Discomfort swap: ${getEx(e.exerciseId).name}${e.note ? ` – ${e.note}` : ''}`);
  }
  return out;
}

/* ---------- volume ---------- */
export function weeklyVolume(sessions: Session[], week: number, getEx: (id: string) => Exercise) {
  const v: Partial<Record<Muscle, number>> = {};
  for (const s of finished(sessions).filter((x) => x.weekNumber === week)) {
    for (const e of s.exercises) {
      const n = workingSets(e.sets).length;
      if (!n) continue;
      const ex = getEx(e.exerciseId);
      ex.primary.forEach((m) => { v[m] = (v[m] ?? 0) + n; });
      ex.secondary.forEach((m) => { v[m] = (v[m] ?? 0) + n * 0.5; });
    }
  }
  return v;
}

export const sessionMinutes = (s: Session) =>
  s.endedAt ? (new Date(s.endedAt).getTime() - new Date(s.startedAt).getTime()) / 60000 : 0;

