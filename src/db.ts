import Dexie, { type Table } from 'dexie';
import type { Exercise, ExerciseNote, Session, Settings, WeekRemark } from './types.ts';
import { LIB } from './seed/library.ts';
import { DEFAULT_BLOCK_START, DEFAULT_EQUIP } from './seed/program.ts';
import { SEED_LEGACY, SEED_NOTES, SEED_REMARKS, SEED_SESSIONS } from './seed/week1.ts';
import { normalizeSessions, planImport, type HevyResult, type ImportPlan } from './csv.ts';
import { parseHevyText, pastedResult, replacedBy } from './hevyText.ts';
import { NOTES, REVIEWS } from './seed/weeks/reviews.ts';
import { mondayOf, parseDate, weekNumber } from './engine.ts';

export interface LegacyRow { id: string; name: string; type: 'compound' | 'isolation' }

class GymDB extends Dexie {
  sessions!: Table<Session, string>;
  weekRemarks!: Table<WeekRemark, number>;
  exerciseNotes!: Table<ExerciseNote, string>;
  kv!: Table<{ key: string; value: unknown }, string>;
  legacy!: Table<LegacyRow, string>;
  constructor() {
    super('gym');
    this.version(1).stores({
      sessions: 'id,startedAt,weekNumber',
      weekRemarks: 'weekNumber',
      exerciseNotes: 'exerciseId',
      overrides: 'slotId',
      kv: 'key',
      legacy: 'id',
    });
    this.version(2).stores({ overrides: null, rotation: 'id' });
    this.version(3).stores({ rotation: null });
  }
}
export const db = new GymDB();

/* exercise lookup: library first, then imported "legacy" exercises */
let legacyMap: Record<string, LegacyRow> = {};
export const setLegacy = (rows: LegacyRow[]) => { legacyMap = Object.fromEntries(rows.map((r) => [r.id, r])); };
export function getEx(id: string): Exercise {
  if (LIB[id]) return LIB[id];
  const l = legacyMap[id];
  return {
    id, name: l?.name ?? id.replace(/^legacy-/, '').replace(/-/g, ' '), hevyNames: [], type: l?.type ?? 'isolation',
    loadType: 'machine', primary: [], secondary: [], description: '', cues: [], legacy: true,
  };
}

export const DEFAULT_SETTINGS: Settings = { blockStart: DEFAULT_BLOCK_START, equip: DEFAULT_EQUIP };
export async function getSettings(): Promise<Settings> {
  const row = await db.kv.get('settings');
  const v = (row?.value ?? {}) as Partial<Settings>;
  return { blockStart: v.blockStart ?? DEFAULT_SETTINGS.blockStart, equip: { ...DEFAULT_EQUIP, ...v.equip } };
}
export const saveSettings = (s: Settings) => db.kv.put({ key: 'settings', value: s });

/** Remarks are keyed by week number, so they move with the block start and stay on their calendar week. */
export async function saveBlockStart(s: Settings, blockStart: string) {
  const delta = Math.round((mondayOf(parseDate(s.blockStart)).getTime() - mondayOf(parseDate(blockStart)).getTime()) / (7 * 86400000));
  await db.transaction('rw', db.kv, db.weekRemarks, async () => {
    if (delta) {
      const remarks = await db.weekRemarks.toArray();
      await db.weekRemarks.clear();
      await db.weekRemarks.bulkPut(remarks.map((r) => ({ ...r, weekNumber: r.weekNumber + delta })));
    }
    await saveSettings({ ...s, blockStart });
  });
}

const hevySeed = import.meta.glob('./seed/hevy.json', { eager: true, import: 'default' }) as Record<string, HevyResult>;

export async function addImported(res: HevyResult): Promise<ImportPlan> {
  const plan = planImport(await db.sessions.toArray(), res.sessions);
  // legacy names first: the sessions' live query re-renders as soon as they are written
  await db.legacy.bulkPut(res.legacy);
  setLegacy(await db.legacy.toArray());
  await db.sessions.bulkPut([...plan.add, ...plan.update]);
  return plan;
}
export const removeSessions = (ids: string[]) => db.sessions.bulkDelete(ids);
export async function addPasted(res: HevyResult) {
  const replaced = replacedBy(await db.sessions.toArray(), res.sessions);
  const plan = await addImported(res);
  await removeSessions(replaced.map((s) => s.id));
  return { plan, replaced: replaced.length };
}

async function normalizeData() {
  const before = await db.sessions.toArray();
  const after = normalizeSessions(before);
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  await db.transaction('rw', db.sessions, async () => { await db.sessions.clear(); await db.sessions.bulkPut(after); });
}

/** Adds week 1 once, so removing a session later sticks. Days an import already covers are left alone. */
async function addWeek1() {
  if (await db.kv.get('week1')) return;
  await db.transaction('rw', db.sessions, db.legacy, db.kv, async () => {
    const day = (s: Session) => new Date(s.startedAt).toDateString();
    const have = new Set((await db.sessions.toArray()).map(day));
    await db.legacy.bulkPut(SEED_LEGACY);
    await db.sessions.bulkPut(SEED_SESSIONS.filter((s) => !have.has(day(s))));
    await db.kv.put({ key: 'week1', value: true });
  });
}

const WEEK_TEXTS = import.meta.glob<string>('./seed/weeks/*.txt', { eager: true, query: '?raw', import: 'default' });

/**
 * Weeks of Hevy text shipped with the app, and their reviews. Each session and review is added once,
 * so deleting or rewriting one here sticks. Days an import already covers are left alone.
 */
async function addBundled() {
  const done = new Set(((await db.kv.get('bundled'))?.value as string[] | undefined) ?? []);
  const { blockStart } = await getSettings();
  const res = pastedResult(Object.values(WEEK_TEXTS).flatMap((t) => parseHevyText(t)), blockStart);
  const fresh = res.sessions.filter((s) => !done.has(s.id));
  const reviews = REVIEWS.filter((r) => !done.has(`review:${r.from}`));
  const notes = NOTES.filter((n) => !done.has(`note:${n.key}`));
  if (!fresh.length && !reviews.length && !notes.length) return;
  await db.transaction('rw', [db.sessions, db.legacy, db.weekRemarks, db.exerciseNotes, db.kv], async () => {
    const day = (s: Session) => new Date(s.startedAt).toDateString();
    const have = new Set((await db.sessions.toArray()).map(day));
    await db.legacy.bulkPut(res.legacy);
    await db.sessions.bulkPut(fresh.filter((s) => !have.has(day(s))));
    for (const r of reviews) {
      const week = weekNumber(parseDate(r.from), blockStart);
      if (!(await db.weekRemarks.get(week))) await db.weekRemarks.put({ weekNumber: week, text: r.text });
    }
    for (const n of notes) if (!(await db.exerciseNotes.get(n.exerciseId))) await db.exerciseNotes.put({ exerciseId: n.exerciseId, text: n.text });
    await db.kv.put({ key: 'bundled', value: [...done, ...fresh.map((s) => s.id), ...reviews.map((r) => `review:${r.from}`), ...notes.map((n) => `note:${n.key}`)] });
  });
}

export async function seedIfEmpty() {
  if (!(await db.kv.get('seeded'))) {
    await db.transaction('rw', db.tables, async () => {
      await db.weekRemarks.bulkPut(SEED_REMARKS);
      await db.exerciseNotes.bulkPut(SEED_NOTES);
      await db.kv.put({ key: 'seeded', value: true });
    });
    for (const h of Object.values(hevySeed)) await addImported(h);
  }
  await addWeek1();
  await addBundled();
  await normalizeData();
  setLegacy(await db.legacy.toArray());
}

const BACKUP_VERSION = 1;
export async function exportAll() {
  const out: Record<string, unknown> = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return JSON.stringify({ app: 'gym-tracker', version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data: out }, null, 1);
}
export async function importAll(text: string) {
  const j = JSON.parse(text);
  if (j.app !== 'gym-tracker' || typeof j.data !== 'object' || !j.data) throw new Error('Not a Gym Tracker backup');
  if (j.version > BACKUP_VERSION) throw new Error('This backup is from a newer version of the app. Update the app first.');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) { await t.clear(); await t.bulkPut(j.data[t.name] ?? []); }
  });
  await normalizeData();
  setLegacy(await db.legacy.toArray());
}
export async function resetAll() {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
  setLegacy([]);
}
