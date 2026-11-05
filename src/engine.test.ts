import { describe, expect, it } from 'vitest';
import { dayOfSession, doseFor, navigableWeeks, pickVariant, sessionName, stepLoad, targetFor, variantForWeek, weekNumber } from './engine.ts';
import { LIB } from './seed/library.ts';
import { DEFAULT_EQUIP, SLOT_BY_ID } from './seed/program.ts';
import { SEED_SESSIONS } from './seed/week1.ts';
import type { Session } from './types.ts';

const eq = DEFAULT_EQUIP;
const getEx = (id: string) => LIB[id] ?? { ...LIB['db-curl'], id, name: id };
const sessions = SEED_SESSIONS;
const t = (exId: string, slotId: string, s: Session[] = sessions) => targetFor(LIB[exId], SLOT_BY_ID[slotId], s, eq);

describe('rotation & weeks', () => {
  it('maps weeks to variants', () => {
    expect([1, 2, 3, 4, 0, -2].map(variantForWeek)).toEqual(['A', 'B', 'A', 'B', 'A', 'A']);
  });
  it('computes week numbers from block start', () => {
    expect(weekNumber(new Date(2026, 9, 26), '2026-10-26')).toBe(1);
    expect(weekNumber(new Date(2026, 10, 1), '2026-10-26')).toBe(1);
    expect(weekNumber(new Date(2026, 10, 2), '2026-10-26')).toBe(2);
    expect(weekNumber(new Date(2026, 9, 25), '2026-10-26')).toBe(0);
  });
  it('skips unavailable equipment', () => {
    const slot = SLOT_BY_ID['L5b'];
    expect(pickVariant(slot, 2, { ...eq, unavailable: ['reverse pec deck'] }, getEx).exerciseId).toBe('rope-face-pull');
    expect(pickVariant(slot, 2, eq, getEx).exerciseId).toBe('reverse-pec-deck');
  });
  it('uses Nordic curls only once the anchor is found, at their own dose', () => {
    const slot = SLOT_BY_ID['L3'];
    expect(pickVariant(slot, 2, eq, getEx).exerciseId).toBe('seated-leg-curl');
    expect(pickVariant(slot, 2, { ...eq, found: ['nordic anchor'] }, getEx).exerciseId).toBe('nordic-curl');
    expect(pickVariant(slot, 3, { ...eq, found: ['nordic anchor'] }, getEx).exerciseId).toBe('seated-leg-curl');
    expect([doseFor(slot, 'nordic-curl').sets, doseFor(slot, 'nordic-curl').repMax]).toEqual([2, 6]);
    expect(doseFor(slot, 'seated-leg-curl').sets).toBe(3);
  });
});

describe('pairings', () => {
  const on = (slotId: string, week: number) => pickVariant(SLOT_BY_ID[slotId], week, eq, getEx).exerciseId;
  const weeks = [2, 3, 4, 5, 6, 7, 8, 9];
  it('never puts the flat fly and the incline curl in one session', () => {
    for (const w of weeks) expect(on('B4', w) === 'flat-db-fly' && on('B5a', w) === 'incline-db-curl').toBe(false);
  });
  it('gives Upper C the arm exercises Upper B did not use that week', () => {
    for (const w of weeks) {
      expect(on('C4a', w)).not.toBe(on('B5a', w));
      expect(on('C4b', w)).not.toBe(on('B5b', w));
    }
  });
  it('sets the weeks as chosen', () => {
    const slots = ['A4b', 'L4a', 'L5b', 'B4', 'B5a', 'B5b'];
    expect(slots.map((s) => on(s, 3))).toEqual(['overhead-cable-triceps-ext', 'standing-calf-raise', 'rope-face-pull', 'flat-db-fly', 'ez-bar-curl', 'v-bar-pushdown']);
    expect(slots.map((s) => on(s, 2))).toEqual(['ez-skull-crusher-behind-head', 'leg-press-calf-press', 'reverse-pec-deck', 'seated-cable-fly', 'incline-db-curl', 'rope-pushdown']);
  });
});

describe('week 1 sessions', () => {
  it('match the volume Hevy reports', () => {
    const volume = (s: Session) => s.exercises.flatMap((e) => e.sets).reduce((a, x) => a + (x.weightKg ?? 0) * (x.reps ?? 0), 0);
    expect(sessions.map(volume)).toEqual([5041, 6082, 3915]);
  });
});

describe('session days', () => {
  const asHevy = (s: Session, title: string): Session => ({ ...s, dayId: undefined, title });
  it('tells the day from the exercises when the title is a Hevy default', () => {
    expect(sessions.map((s) => dayOfSession(asHevy(s, 'Evening workout')))).toEqual(['upperA', 'lower', 'upperB']);
  });
  it('prefers a title that names the day', () => {
    expect(dayOfSession(asHevy(sessions[0], 'Lower'))).toBe('lower');
  });
  it('makes no guess before the block, or on a tie', () => {
    expect(dayOfSession({ ...asHevy(sessions[0], 'Push'), weekNumber: 0 })).toBeUndefined();
    const tied = { ...asHevy(sessions[0], 'Mixed'), exercises: [...sessions[0].exercises.filter((e) => e.exerciseId === 'bench-press-barbell'), ...sessions[1].exercises.filter((e) => e.exerciseId === 'rdl-barbell')] };
    expect(dayOfSession(tied)).toBeUndefined();
  });
  it('names a session without emoji', () => {
    expect(sessionName(asHevy(sessions[0], 'Evening workout 🏋️'))).toBe('Upper A');
    expect(sessionName({ ...asHevy(sessions[0], 'Evening workout 🏋️'), exercises: [] })).toBe('Evening workout');
  });
});

describe('week switchers', () => {
  const at = (weekNumber: number) => ({ ...sessions[0], weekNumber });
  it('can always go back to earlier block weeks, even with no data', () => {
    expect(navigableWeeks([], 2)).toEqual([1, 2]);
    expect(navigableWeeks([], 4, 2)).toEqual([1, 2, 3, 4, 5, 6]);
  });
  it('adds pre-block weeks only when they have data, and never a future week without asking', () => {
    expect(navigableWeeks([at(-3), at(9)], 2)).toEqual([-3, 1, 2]);
  });
});

describe('week 2 targets from seed', () => {
  it('bench', () => {
    const x = t('bench-press-barbell', 'A1');
    expect(x.weightKg).toBe(52.5); expect(x.repGoals).toEqual([9, 9, 9]); expect(x.flags).toContain('pyramid');
  });
  it('lat pulldown', () => { const x = t('lat-pulldown', 'A2'); expect([x.weightKg, x.repGoals]).toEqual([50, [9, 9, 9]]); });
  it('seated row ignores the extra session', () => { const x = t('seated-cable-row-v', 'A3'); expect([x.weightKg, x.repGoals]).toEqual([52, [9, 11, 11]]); });
  it('ohp', () => { const x = t('overhead-press-barbell', 'B1'); expect([x.weightKg, x.repGoals]).toEqual([30, [9, 9, 9]]); });
  it('incline db press keeps 20', () => { expect(t('incline-db-press', 'B2').weightKg).toBe(20); });
  it('rdl', () => { const x = t('rdl-barbell', 'L1'); expect([x.weightKg, x.repGoals]).toEqual([53, [9, 9, 9]]); });
  it('leg press locked + overCap', () => {
    const x = t('leg-press-horizontal', 'L2');
    expect(x.weightKg).toBe(85); expect(x.flags).toContain('overCap');
  });
  it('seated leg curl', () => { const x = t('seated-leg-curl', 'L3'); expect(x.weightKg).toBe(50); expect(x.flags).toContain('pyramid'); });
  it('overhead cable triceps', () => { expect(t('overhead-cable-triceps-ext', 'A4b').weightKg).toBe(20); });
  it('cable lateral rounds 4.5 down to 2.5', () => { expect(t('single-arm-cable-lateral', 'L5a').weightKg).toBe(2.5); });
  it('calf raise needs load', () => { const x = t('standing-calf-raise', 'L4a'); expect(x.weightKg).toBeNull(); expect(x.reason).toBe('Add load'); });
  it('B variants calibrate', () => {
    expect(t('incline-db-curl', 'B5a').flags).toContain('calibrate');
    expect(t('ez-skull-crusher-behind-head', 'A4b').flags).toContain('calibrate');
  });
});

describe('progression rules', () => {
  const mk = (sets: [number, number][], rpe?: number): Session => ({
    id: Math.random().toString(), title: 'x', weekNumber: 1, source: 'app', startedAt: new Date(2026, 9, 1 + Math.floor(Math.random() * 20)).toISOString(), endedAt: new Date().toISOString(),
    exercises: [{ exerciseId: 'bench-press-barbell', slotId: 'A1', sets: sets.map(([w, r], i) => ({ index: i, type: 'working', weightKg: w, reps: r, rpe })) }],
  });
  it('adds weight after hitting the top on all sets', () => {
    const x = t('bench-press-barbell', 'A1', [mk([[50, 10], [50, 10], [50, 10]])]);
    expect([x.weightKg, x.repGoals]).toEqual([52.5, [6, 6, 6]]);
  });
  it('lower body needs RPE ≤ 7 or two sessions at the top', () => {
    const slot = SLOT_BY_ID['L1'];
    const rdl = (reps: number, rpe?: number): Session => ({ ...mk([]), exercises: [{ exerciseId: 'rdl-barbell', slotId: 'L1', sets: [0, 1, 2].map((i) => ({ index: i, type: 'working' as const, weightKg: 50, reps, rpe })) }] });
    expect(targetFor(LIB['rdl-barbell'], slot, [rdl(10, 9)], eq).weightKg).toBe(50);
    expect(targetFor(LIB['rdl-barbell'], slot, [rdl(10, 7)], eq).weightKg).toBe(52.5);
  });
  it('too light jumps two steps', () => {
    expect(t('bench-press-barbell', 'A1', [mk([[40, 13], [40, 13], [40, 14]])]).weightKg).toBe(45);
  });
  it('cuts 10% after two sessions below range', () => {
    const a = mk([[60, 5], [60, 5], [60, 5]]); a.startedAt = new Date(2026, 9, 1).toISOString();
    const b = mk([[60, 4], [60, 5], [60, 5]]); b.startedAt = new Date(2026, 9, 8).toISOString();
    expect(t('bench-press-barbell', 'A1', [a, b]).weightKg).toBe(52.5);
  });
  it('dumbbell steps follow the available list', () => {
    expect(stepLoad(10, LIB['db-curl'], eq)).toBe(12);
  });
});
