import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getSettings } from './db.ts';
import { weekNumber } from './engine.ts';
import type { ExerciseNote, Session, Settings, WeekRemark } from './types.ts';

export interface Data {
  sessions: Session[];
  settings: Settings;
  remarks: WeekRemark[];
  notes: ExerciseNote[];
}
const Ctx = createContext<Data>(null!);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }: { children: ReactNode }) {
  const stored = useLiveQuery(() => db.sessions.toArray());
  const settings = useLiveQuery(getSettings);
  const remarks = useLiveQuery(() => db.weekRemarks.toArray());
  const notes = useLiveQuery(() => db.exerciseNotes.toArray());
  // the week always comes from the date and the current block start, never a value saved earlier
  const sessions = useMemo(
    () => (stored && settings ? stored.map((s) => ({ ...s, weekNumber: weekNumber(new Date(s.startedAt), settings.blockStart) })) : undefined),
    [stored, settings],
  );
  if (!sessions || !settings || !remarks || !notes) return null;
  return <Ctx.Provider value={{ sessions, settings, remarks, notes }}>{children}</Ctx.Provider>;
}
