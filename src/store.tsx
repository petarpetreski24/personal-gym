import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, db, getSettings } from './db.ts';
import type { ExerciseNote, Session, Settings, SlotOverride, WeekRemark } from './types.ts';

export interface Data {
  sessions: Session[];
  settings: Settings;
  remarks: WeekRemark[];
  notes: ExerciseNote[];
  overrides: SlotOverride[];
}
const Ctx = createContext<Data>(null!);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }: { children: ReactNode }) {
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const settings = useLiveQuery(getSettings);
  const remarks = useLiveQuery(() => db.weekRemarks.toArray());
  const notes = useLiveQuery(() => db.exerciseNotes.toArray());
  const overrides = useLiveQuery(() => db.overrides.toArray());
  if (!sessions || !remarks || !notes || !overrides) return null;
  return <Ctx.Provider value={{ sessions, settings: settings ?? DEFAULT_SETTINGS, remarks, notes, overrides }}>{children}</Ctx.Provider>;
}
