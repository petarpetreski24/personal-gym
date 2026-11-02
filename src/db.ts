import Dexie, { type Table } from 'dexie';
import type { Exercise, ExerciseNote, RotationOverride, Session, Settings, WeekRemark } from './types.ts';
import { LIB } from './seed/library.ts';
import { DEFAULT_BLOCK_START, DEFAULT_EQUIP } from './seed/program.ts';
import { SEED_NOTES, SEED_REMARKS } from './seed/week1.ts';
import { normalizeSessions, planImport, type HevyResult, type ImportPlan } from './csv.ts';
import { mondayOf, parseDate } from './engine.ts';

export interface LegacyRow { id: string; name: string; type: 'compound' | 'isolation' }

class GymDB extends Dexie {
  sessions!: Table<Session, string>;
  weekRemarks!: Table<WeekRemark, number>;
  exerciseNotes!: Table<ExerciseNote, string>;
  rotation!: Table<RotationOverride, string>;
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

/** Remarks and locks are keyed by week number, so they move with the block start and stay on their calendar week. */
export async function saveBlockStart(s: Settings, blockStart: string) {
  const delta = Math.round((mondayOf(parseDate(s.blockStart)).getTime() - mondayOf(parseDate(blockStart)).getTime()) / (7 * 86400000));
  await db.transaction('rw', db.kv, db.weekRemarks, db.rotation, async () => {
    if (delta) {
      const remarks = await db.weekRemarks.toArray();
      const locks = await db.rotation.toArray();
      await db.weekRemarks.clear();
      await db.rotation.clear();
      await db.weekRemarks.bulkPut(remarks.map((r) => ({ ...r, weekNumber: r.weekNumber + delta })));
      await db.rotation.bulkPut(locks.map((r) => ({ ...r, weekNumber: r.weekNumber + delta, id: `${r.weekNumber + delta}:${r.slotId}` })));
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

async function normalizeData() {
  const before = await db.sessions.toArray();
  const after = normalizeSessions(before);
  if (JSON.stringify(before) === JSON.stringify(after)) return;
  await db.transaction('rw', db.sessions, async () => { await db.sessions.clear(); await db.sessions.bulkPut(after); });
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
