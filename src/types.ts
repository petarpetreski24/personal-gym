export type ExerciseType = 'compound' | 'isolation';
export type LoadType = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight';
export type Muscle = 'chest' | 'lats_upper_back' | 'side_delts' | 'rear_delts' | 'front_delts'
  | 'triceps' | 'biceps' | 'forearms' | 'quads' | 'hamstrings' | 'glutes' | 'calves' | 'core';

export interface Exercise {
  id: string;
  name: string;
  hevyNames: string[];
  type: ExerciseType;
  loadType: LoadType;
  perSide?: boolean;
  primary: Muscle[];
  secondary: Muscle[];
  description: string;
  cues: string[];
  mistakes?: string[];
  equipment?: string; // usable unless marked unavailable
  needs?: string; // optional kit: not usable until marked as found
  legacy?: boolean;
}

export type DayId = 'upperA' | 'lower' | 'upperB' | 'upperC';
export interface Day { id: DayId; name: string; order: number; optional: boolean; }

export interface Slot {
  id: string;
  dayId: DayId;
  order: number;
  label: string;
  superset?: string;
  sets: number;
  repMin: number; repMax: number;
  rpeTarget: [number, number];
  kind: 'fixed' | 'rotating';
  exerciseId?: string;
  variants?: { A: string; B: string };
  doses?: Record<string, Pick<Slot, 'sets' | 'repMin' | 'repMax'>>; // an exercise that needs a different dose from the slot's
  lockedLoadKg?: number;
  lowerBody?: boolean;
}

export type SetType = 'warmup' | 'working' | 'failure' | 'drop';
export interface SetLog {
  index: number; type: SetType; weightKg: number | null; reps: number | null; rpe?: number;
  done?: boolean; // app sessions only: set ticked off
}

export interface SessionExercise {
  slotId?: string;
  exerciseId: string;
  swappedFromExerciseId?: string;
  swapReason?: 'equipment_busy' | 'equipment_missing' | 'discomfort' | 'other';
  note?: string;
  extra?: boolean;     // outside the plan: shown in "previous" but never drives targets
  reason?: string;     // why the target was set
  sets: SetLog[];
}

export interface Session {
  id: string;
  dayId?: DayId;
  title: string;
  weekNumber: number;
  startedAt: string; endedAt?: string;
  remark?: string;
  edited?: boolean; // a set was corrected in the app, so re-importing must not overwrite it
  source: 'app' | 'hevy_import' | 'seed';
  exercises: SessionExercise[];
}

export interface WeekRemark { weekNumber: number; text: string; }
export interface ExerciseNote { exerciseId: string; text: string; }

export interface Equip {
  dumbbells: number[];
  cableStep: number;
  barStep: number;
  unavailable: string[];
  found: string[];
}
export interface Settings { blockStart: string; equip: Equip; }

export interface Target {
  weightKg: number | null;
  repGoals: number[];
  reason: string;
  flags: string[];
}
