import { describe, expect, it } from 'vitest';
import { parseCsv, parseHevy, parseHevyDate } from './csv.ts';
import { targetFor } from './engine.ts';
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
