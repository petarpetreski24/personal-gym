import Dexie, { type Table } from 'dexie';
import type { Exercise, ExerciseNote, Session, Settings, SlotOverride, WeekRemark } from './types.ts';
import { LIB } from './seed/library.ts';
import { DEFAULT_BLOCK_START, DEFAULT_EQUIP } from './seed/program.ts';
import { SEED_LEGACY, SEED_NOTES, SEED_REMARKS, SEED_SESSIONS } from './seed/week1.ts';
import type { HevyResult } from './csv.ts';

export interface LegacyRow { id: string; name: string; type: 'compound' | 'isolation' }

class GymDB extends Dexie {
  sessions!: Table<Session, string>;
  weekRemarks!: Table<WeekRemark, number>;
  exerciseNotes!: Table<ExerciseNote, string>;
  overrides!: Table<SlotOverride, string>;
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

const hevySeed = import.meta.glob('./seed/hevy.json', { eager: true, import: 'default' }) as Record<string, HevyResult>;

export async function addImported(res: HevyResult): Promise<number> {
  const existing = new Set(await db.sessions.toCollection().primaryKeys());
  const fresh = res.sessions.filter((s) => !existing.has(s.id));
  await db.sessions.bulkPut(fresh);
  await db.legacy.bulkPut(res.legacy);
  setLegacy(await db.legacy.toArray());
  return fresh.length;
}

export async function seedIfEmpty() {
  if (!(await db.kv.get('seeded'))) {
    await db.transaction('rw', db.tables, async () => {
      await db.sessions.bulkPut(SEED_SESSIONS);
      await db.legacy.bulkPut(SEED_LEGACY);
      await db.weekRemarks.bulkPut(SEED_REMARKS);
      await db.exerciseNotes.bulkPut(SEED_NOTES);
      await db.kv.put({ key: 'seeded', value: true });
    });
    for (const h of Object.values(hevySeed)) await addImported(h);
  }
  setLegacy(await db.legacy.toArray());
}

export async function exportAll() {
  const out: Record<string, unknown> = {};
  for (const t of db.tables) out[t.name] = await t.toArray();
  return JSON.stringify({ app: 'gym-tracker', version: 1, exportedAt: new Date().toISOString(), data: out }, null, 1);
}
export async function importAll(text: string) {
  const j = JSON.parse(text);
  if (j.app !== 'gym-tracker') throw new Error('Not a Gym Tracker backup');
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) { await t.clear(); await t.bulkPut(j.data[t.name] ?? []); }
  });
  setLegacy(await db.legacy.toArray());
}
export async function resetAll() {
  await db.transaction('rw', db.tables, async () => { for (const t of db.tables) await t.clear(); });
  setLegacy([]);
}
