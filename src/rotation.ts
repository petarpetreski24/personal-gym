import type { RotationOverride, Settings, Slot } from './types.ts';
import { SLOTS } from './seed/program.ts';
import { pickVariant, type Variant } from './engine.ts';
import { getEx } from './db.ts';

export const LETTERS: Variant[] = ['A', 'B', 'C'];

/** All rotating slots; C3 repeats A4a's variants, so `unique` drops duplicates for read-only views. */
export const rotatingSlots = (unique = false) => {
  const seen = new Set<string>();
  return SLOTS.filter((s) => {
    if (s.kind !== 'rotating') return false;
    if (!unique) return true;
    const sig = Object.values(s.variants!).join('|');
    if (seen.has(sig)) return false;
    seen.add(sig);
    return true;
  });
};

/** The calendar's pick for a slot (equipment-aware), ignoring manual choices. */
export const autoVariant = (slot: Slot, week: number, settings: Settings) => pickVariant(slot, week, settings.equip, getEx);

/** What the plan says for a slot in a week: manual choice if any, else the calendar. */
export function plannedVariant(slot: Slot, week: number, settings: Settings, rotation: RotationOverride[]) {
  const o = rotation.find((r) => r.weekNumber === week && r.slotId === slot.id);
  if (o) return { variant: o.variant, exerciseId: slot.variants![o.variant], manual: true };
  return { ...autoVariant(slot, week, settings), manual: false };
}
