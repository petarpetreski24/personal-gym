import type { Day, Muscle, Slot } from '../types.ts';

export const DAYS: Day[] = [
  { id: 'upperA', name: 'Upper A', order: 1, optional: false },
  { id: 'lower', name: 'Lower', order: 2, optional: false },
  { id: 'upperB', name: 'Upper B', order: 3, optional: false },
  { id: 'upperC', name: 'Upper C', order: 4, optional: true },
];
export const DAY_INFO: Record<string, { when: string; mins: number }> = {
  upperA: { when: 'Mon', mins: 50 },
  lower: { when: 'Wed (Tue on 4-day weeks)', mins: 55 },
  upperB: { when: 'Fri (Thu on 4-day weeks)', mins: 55 },
  upperC: { when: 'Sat (optional)', mins: 45 },
};

/** Sessions before this date followed the old three-way rotation, so they aren't judged against this plan. */
export const PLAN_FROM = new Date(2026, 10, 5);

type V = [string, string];
let n = 0;
function f(id: string, dayId: Slot['dayId'], label: string, ex: string, sets: number, repMin: number, repMax: number, rpe: [number, number], o: Partial<Slot> = {}): Slot {
  return { id, dayId, order: ++n, label, kind: 'fixed', exerciseId: ex, sets, repMin, repMax, rpeTarget: rpe, ...o };
}
function r(id: string, dayId: Slot['dayId'], label: string, v: V, sets: number, repMin: number, repMax: number, rpe: [number, number], o: Partial<Slot> = {}): Slot {
  return { id, dayId, order: ++n, label, kind: 'rotating', variants: { A: v[0], B: v[1] }, sets, repMin, repMax, rpeTarget: rpe, ...o };
}

/*
 * Variants are paired across the whole week, so week A and week B each read as one plan:
 * A: heavier arms (EZ bar + V-bar), flat DB fly, overhead triceps.
 * B: lighter arms (incline curl + rope), cable fly, skull crusher as the week's one heavy triceps lift.
 * The flat fly and incline curl both stretch the front of the shoulder, so they never share a session.
 * Upper C takes the arm exercise Upper B didn't use that week.
 */
export const SLOTS: Slot[] = [
  f('A1', 'upperA', 'Horizontal press', 'bench-press-barbell', 3, 6, 10, [8, 9]),
  f('A2', 'upperA', 'Vertical pull', 'lat-pulldown', 3, 8, 12, [8, 9]),
  f('A3', 'upperA', 'Row', 'seated-cable-row-v', 3, 8, 12, [8, 9]),
  f('A4a', 'upperA', 'Side delts', 'db-lateral-raise', 3, 12, 20, [9, 10], { superset: 'A4' }),
  r('A4b', 'upperA', 'Triceps, overhead', ['overhead-cable-triceps-ext', 'ez-skull-crusher-behind-head'], 3, 10, 15, [9, 10], { superset: 'A4' }),

  f('L1', 'lower', 'Hip hinge', 'rdl-barbell', 3, 6, 10, [7, 8], { lowerBody: true }),
  f('L2', 'lower', 'Leg press', 'leg-press-horizontal', 3, 8, 10, [7, 8], { lowerBody: true, lockedLoadKg: 85 }),
  r('L3', 'lower', 'Hamstring curl', ['seated-leg-curl', 'nordic-curl'], 3, 8, 12, [8, 9], { lowerBody: true, doses: { 'nordic-curl': { sets: 2, repMin: 3, repMax: 6 } } }),
  r('L4a', 'lower', 'Calves', ['standing-calf-raise', 'leg-press-calf-press'], 2, 10, 15, [9, 9], { lowerBody: true }),
  f('L5a', 'lower', 'Side delts (cable)', 'single-arm-cable-lateral', 2, 12, 20, [9, 10], { superset: 'L5' }),
  r('L5b', 'lower', 'Rear delts', ['rope-face-pull', 'reverse-pec-deck'], 2, 12, 20, [9, 10], { superset: 'L5' }),

  f('B1', 'upperB', 'Vertical press', 'overhead-press-barbell', 3, 6, 10, [8, 9]),
  f('B2', 'upperB', 'Incline press', 'incline-db-press', 3, 8, 12, [8, 9]),
  f('B3', 'upperB', 'Supported row', 'one-arm-db-row', 3, 8, 12, [8, 9]),
  r('B4', 'upperB', 'Chest fly', ['flat-db-fly', 'seated-cable-fly'], 3, 10, 15, [9, 10]),
  r('B5a', 'upperB', 'Biceps', ['ez-bar-curl', 'incline-db-curl'], 3, 8, 12, [9, 10], { superset: 'B5' }),
  r('B5b', 'upperB', 'Triceps, pushdown', ['v-bar-pushdown', 'rope-pushdown'], 2, 10, 15, [9, 10], { superset: 'B5' }),

  f('C1', 'upperC', 'Chest press', 'chest-press-machine', 3, 8, 12, [8, 9]),
  f('C2', 'upperC', 'Pull-up', 'assisted-pull-up', 3, 6, 12, [8, 9]),
  f('C3', 'upperC', 'Side delts', 'db-lateral-raise', 3, 12, 20, [9, 10]),
  r('C4a', 'upperC', 'Biceps, extra', ['incline-db-curl', 'ez-bar-curl'], 3, 8, 12, [9, 10], { superset: 'C4' }),
  r('C4b', 'upperC', 'Triceps, extra', ['rope-pushdown', 'v-bar-pushdown'], 3, 10, 15, [9, 10], { superset: 'C4' }),
];

export const SLOT_BY_ID: Record<string, Slot> = Object.fromEntries(SLOTS.map((s) => [s.id, s]));
export const PLANNED_IDS = new Set(SLOTS.flatMap((s) => (s.exerciseId ? [s.exerciseId] : Object.values(s.variants!))));

export const MUSCLE_TARGETS: { muscle: Muscle; label: string; min: number; max?: number; note?: string }[] = [
  { muscle: 'chest', label: 'Chest', min: 10 },
  { muscle: 'lats_upper_back', label: 'Lats / upper back', min: 10 },
  { muscle: 'side_delts', label: 'Side delts', min: 6, max: 10 },
  { muscle: 'triceps', label: 'Triceps', min: 6, max: 10 },
  { muscle: 'biceps', label: 'Biceps', min: 6, max: 10 },
  { muscle: 'rear_delts', label: 'Rear delts', min: 2 },
  { muscle: 'hamstrings', label: 'Hamstrings', min: 6, note: 'maintain' },
  { muscle: 'quads', label: 'Quads', min: 3, note: 'by choice' },
  { muscle: 'calves', label: 'Calves', min: 2, note: 'maintain' },
];

export const DEFAULT_EQUIP = {
  dumbbells: [2, 4, 5, 6, 7, 7.5, 8, 9, 10, 12, 12.5, 14, 15, 16, 17.5, 20, 22.5, 25, 27.5, 30, 32.5, 35],
  cableStep: 2.5,
  barStep: 2.5,
  unavailable: [] as string[],
  found: [] as string[],
};
export const DEFAULT_BLOCK_START = '2026-10-26';
