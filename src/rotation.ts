import type { Settings, Slot } from './types.ts';
import { SLOTS } from './seed/program.ts';
import { pickVariant, type Variant } from './engine.ts';
import { getEx } from './db.ts';

export const LETTERS: Variant[] = ['A', 'B'];

export const rotatingSlots = () => SLOTS.filter((s) => s.kind === 'rotating');

/** What a slot uses in a week, by the calendar and the equipment available. */
export const plannedVariant = (slot: Slot, week: number, settings: Settings) => pickVariant(slot, week, settings.equip, getEx);
