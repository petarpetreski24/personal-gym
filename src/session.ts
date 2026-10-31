import type { DayId, Session, SessionExercise, Settings, Slot, SlotOverride } from './types.ts';
import { DAYS, SLOTS } from './seed/program.ts';
import { pickVariant, targetFor, weekNumber } from './engine.ts';
import { getEx } from './db.ts';
import { newId } from './util.ts';

export const slotSets = (slot: Slot, overrides: SlotOverride[], week: number) =>
  overrides.find((o) => o.slotId === slot.id && o.fromWeek <= week && o.sets)?.sets ?? slot.sets;

export const slotsOf = (dayId: DayId) => SLOTS.filter((s) => s.dayId === dayId).sort((a, b) => a.order - b.order);

export function resolveSlot(slot: Slot, week: number, settings: Settings) {
  if (slot.kind === 'fixed') return { exerciseId: slot.exerciseId!, variant: null };
  const p = pickVariant(slot, week, settings.equip, getEx);
  return { exerciseId: p.exerciseId, variant: p.variant };
}

export function buildExercise(slot: Slot, exerciseId: string, sessions: Session[], settings: Settings, overrides: SlotOverride[], week: number, excludeId?: string): SessionExercise {
  const sets = slotSets(slot, overrides, week);
  const t = targetFor(getEx(exerciseId), { ...slot, sets }, sessions, settings.equip, excludeId);
  let reason = t.reason;
  if (t.flags.includes('pyramid')) reason += ' · last time pyramided: use straight sets';
  return {
    slotId: slot.id, exerciseId, reason,
    sets: Array.from({ length: sets }, (_, i) => ({ index: i, type: 'working' as const, weightKg: t.weightKg, reps: t.repGoals[i] ?? slot.repMin })),
  };
}

export function buildSession(dayId: DayId, sessions: Session[], settings: Settings, overrides: SlotOverride[]): Session {
  const now = new Date();
  const week = weekNumber(now, settings.blockStart);
  return {
    id: newId(), dayId, title: DAYS.find((d) => d.id === dayId)!.name, weekNumber: week,
    startedAt: now.toISOString(), source: 'app',
    exercises: slotsOf(dayId).map((slot) =>
      buildExercise(slot, resolveSlot(slot, week, settings).exerciseId, sessions, settings, overrides, week)),
  };
}
