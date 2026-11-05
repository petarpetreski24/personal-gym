import { describe, expect, it } from 'vitest';
import { hevySessionId, migrateSessionId, normalizeSessions, parseCsv, parseHevy, parseHevyDate, planImport } from './csv.ts';
import { onSlotDay, reviewExercise, sessionFlags, slotFor, targetFor } from './engine.ts';
import { LIB } from './seed/library.ts';
import { DEFAULT_EQUIP, SLOT_BY_ID } from './seed/program.ts';

const HEAD = 'title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_kg,reps,distance_km,duration_seconds,rpe';
const row = (title: string, day: number, name: string, type: string, kg: number | '', reps: number) =>
  `"${title}","Oct ${day}, 2026, 6:30 PM","Oct ${day}, 2026, 7:20 PM","","${name}","","",0,${type},${kg},${reps},,,`;
const csv = (...rows: string[]) => [HEAD, ...rows].join('\n');

describe('hevy import', () => {
  it('parses quoted cells', () => {
    expect(parseCsv('a,"b, c","d ""e"""\n1,2,3')).toEqual([['a', 'b, c', 'd "e"'], ['1', '2', '3']]);
  });
  it('parses Hevy dates as local time', () => {
    const d = new Date(parseHevyDate('Oct 23, 2026, 10:27 PM'));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 9, 23, 22, 27]);
    expect(new Date(parseHevyDate('Oct 23, 2026, 12:05 AM')).getHours()).toBe(0);
  });
  it('reads both date formats Hevy uses, as the same moment and the same session', () => {
    expect(parseHevyDate('23 Oct 2026, 22:27')).toBe(parseHevyDate('Oct 23, 2026, 10:27 PM'));
    expect(hevySessionId('23 Oct 2026, 22:27')).toBe(hevySessionId('Oct 23, 2026, 10:27 PM'));
    expect(hevySessionId('Oct 23, 2026, 10:27 PM')).toBe('hevy:2026-10-23T22:27');
    expect(() => parseHevyDate('sometime')).toThrow(/Unrecognised/);
  });
  it('rejects a file that is not a Hevy export, and survives a byte-order mark', () => {
    expect(() => parseHevy('a,b\n1,2', '2026-10-26')).toThrow(/Not a Hevy export/);
    const withBom = '﻿' + csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8));
    expect(parseHevy(withBom, '2026-10-26').sessions).toHaveLength(1);
  });
  it('groups sessions, maps exercises and set types, computes the week', () => {
    const { sessions, legacy } = parseHevy(csv(
      row('Upper A', 26, 'Bench Press (Barbell)', 'warmup', 30, 10),
      row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8),
      row('Upper A', 26, 'Butterfly (Pec Deck)', 'dropset', 35, 8),
      row('Lower', 28, 'Leg Press Horizontal (Machine)', 'failure', 85, 10),
    ), '2026-10-26');
    expect(sessions.map((s) => s.title)).toEqual(['Upper A', 'Lower']);
    expect(sessions[0].weekNumber).toBe(1);
    expect(sessions[0].exercises[0].exerciseId).toBe('bench-press-barbell');
    expect(sessions[0].exercises[0].sets.map((s) => s.type)).toEqual(['warmup', 'working']);
    expect(sessions[0].exercises[1].exerciseId).toBe('legacy-butterfly-pec-deck');
    expect(sessions[0].exercises[1].sets[0].type).toBe('drop');
    expect(sessions[1].exercises[0].sets[0].type).toBe('failure');
    expect(legacy.map((l) => l.name)).toEqual(['Butterfly (Pec Deck)']);
  });
  it('gives a repeated export the same session ids, so re-import can skip them', () => {
    const text = csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8));
    expect(parseHevy(text, '2026-10-26').sessions[0].id).toBe(parseHevy(text, '2026-10-26').sessions[0].id);
  });
  it('treats a renamed workout as the same session', () => {
    const a = parseHevy(csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8)), '2026-10-26').sessions;
    const b = parseHevy(csv(row('Push day', 26, 'Bench Press (Barbell)', 'normal', 50, 8)), '2026-10-26').sessions;
    const plan = planImport(a, b);
    expect(plan.add).toHaveLength(0);
    expect(plan.update.map((s) => s.title)).toEqual(['Push day']);
  });
  it('re-import brings in Hevy edits but keeps sets corrected in the app', () => {
    const old = parseHevy(csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8)), '2026-10-26').sessions;
    const changed = parseHevy(csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 55, 8)), '2026-10-26').sessions;
    expect(planImport(old, old).update).toHaveLength(0);
    expect(planImport(old, changed).update).toHaveLength(1);
    const plan = planImport([{ ...old[0], edited: true }], changed);
    expect([plan.update.length, plan.keptEdited]).toEqual([0, 1]);
  });
  it('reports sessions gone from the export only inside its date range', () => {
    const sessions = parseHevy(csv(
      row('Upper A', 20, 'Bench Press (Barbell)', 'normal', 50, 8),
      row('Lower', 22, 'Bench Press (Barbell)', 'normal', 50, 8),
      row('Upper B', 24, 'Bench Press (Barbell)', 'normal', 50, 8),
    ), '2026-10-26').sessions;
    const [first, deleted, last] = sessions;
    expect(planImport(sessions, [first, last]).missing.map((s) => s.title)).toEqual([deleted.title]);
    expect(planImport(sessions, [first]).missing).toHaveLength(0); // shorter export: nothing to conclude
  });
  it('migrates old ids and merges the duplicates they allowed, keeping edits', () => {
    expect(migrateSessionId('hevy:Upper A|Oct 26, 2026, 6:30 PM')).toBe('hevy:2026-10-26T18:30');
    const base = parseHevy(csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8)), '2026-10-26').sessions[0];
    const out = normalizeSessions([
      { ...base, id: 'hevy:Upper A|Oct 26, 2026, 6:30 PM' },
      { ...base, id: 'hevy:Push|Oct 26, 2026, 6:30 PM', title: 'Push', edited: true },
      { ...base, id: 'seed-w1', source: 'seed' },
    ]);
    expect(out.map((s) => [s.id, s.title])).toEqual([['hevy:2026-10-26T18:30', 'Push']]);
    expect(normalizeSessions(out)).toEqual(out);
  });
  it('clears non-numeric values saved by older versions', () => {
    const base = parseHevy(csv(row('Upper A', 26, 'Bench Press (Barbell)', 'normal', 50, 8)), '2026-10-26').sessions[0];
    base.exercises[0].sets[0].weightKg = NaN;
    expect(normalizeSessions([base])[0].exercises[0].sets[0].weightKg).toBeNull();
  });
  it('maps a custom Hevy exercise named like the app exercise', () => {
    const { sessions, legacy } = parseHevy(csv(row('Lower', 28, 'Cable Y-Raise', 'normal', 5, 12)), '2026-10-26');
    expect(sessions[0].exercises[0].exerciseId).toBe('cable-y-raise');
    expect(legacy).toEqual([]);
  });
  it('ignores an exercise done on a day whose slots do not include it when setting targets', () => {
    const { sessions } = parseHevy(csv(
      row('Upper A', 26, 'Seated Cable Row - V Grip (Cable)', 'normal', 52, 8),
      row('Upper B', 30, 'Seated Cable Row - V Grip (Cable)', 'normal', 60, 12),
    ), '2026-10-26');
    expect(targetFor(LIB['seated-cable-row-v'], SLOT_BY_ID['A3'], sessions, DEFAULT_EQUIP).weightKg).toBe(52);
  });
});

describe('sessions matched to the program', () => {
  const getEx = (id: string) => LIB[id];
  const one = (title: string, name: string) => parseHevy(csv(row(title, 28, name, 'normal', 20, 15)), '2026-10-26').sessions[0];
  it('does not credit a slot with the same exercise done on another day', () => {
    const lower = one('Lower', 'Triceps Pushdown');
    expect(onSlotDay(lower, SLOT_BY_ID['B5b'])).toBe(false);
    expect(onSlotDay(one('Upper B', 'Triceps Pushdown'), SLOT_BY_ID['B5b'])).toBe(true);
    expect(onSlotDay(one('Evening lift', 'Triceps Pushdown'), SLOT_BY_ID['B5b'])).toBe(true);
  });
  it('flags extra exercises and skipped slots on imported sessions', () => {
    const flags = sessionFlags({ ...one('Lower', 'Triceps Pushdown'), startedAt: new Date(2026, 10, 11, 18).toISOString() }, getEx);
    expect(flags).toContain('Extra exercise: Triceps Pushdown (Rope)');
    expect(flags).toContain('Skipped: Hip hinge');
  });
  it('does not judge sessions from before this plan against it', () => {
    expect(sessionFlags(one('Lower', 'Triceps Pushdown'), getEx).filter((f) => /Skipped|Extra/.test(f))).toEqual([]);
  });
  it('merges seated lateral raises into the one lateral raise, keeping the sets', () => {
    expect(parseHevy(csv(row('Upper A', 26, 'Seated Lateral Raise (Dumbbell)', 'normal', 5, 15)), '2026-10-26').sessions[0].exercises[0].exerciseId).toBe('db-lateral-raise');
    const saved = one('Upper A', 'Lateral Raise (Dumbbell)');
    saved.exercises[0].exerciseId = 'seated-db-lateral-raise';
    const [e] = normalizeSessions([saved])[0].exercises;
    expect([e.exerciseId, e.sets[0].weightKg]).toEqual(['db-lateral-raise', 20]);
  });
  it('uses the slot of the session\'s own day when an exercise is in several', () => {
    const se = { exerciseId: 'rope-pushdown', sets: [] };
    expect(slotFor(se, getEx, one('Upper C', 'Triceps Pushdown')).sets).toBe(3);
    expect(slotFor(se, getEx, one('Upper B', 'Triceps Pushdown')).sets).toBe(2);
  });
  it('reads assisted pull-ups the right way round: less assistance is progress', () => {
    const ex = LIB['assisted-pull-up'];
    const sets = (w: number) => [{ index: 0, type: 'working' as const, weightKg: w, reps: 8 }];
    expect(reviewExercise(sets(30), sets(35), ex, SLOT_BY_ID['C2']).status).toBe('Progressing');
    expect(reviewExercise(sets(35), sets(30), ex, SLOT_BY_ID['C2']).status).toBe('Regressed');
  });
});
