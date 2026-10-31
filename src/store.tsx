import { createContext, useContext, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { DEFAULT_SETTINGS, db, getSettings } from './db.ts';
import type { ExerciseNote, RotationOverride, Session, Settings, WeekRemark } from './types.ts';

export interface Data {
  sessions: Session[];
  settings: Settings;
  remarks: WeekRemark[];
  notes: ExerciseNote[];
  rotation: RotationOverride[];
}
const Ctx = createContext<Data>(null!);
export const useData = () => useContext(Ctx);

export function DataProvider({ children }: { children: ReactNode }) {
  const sessions = useLiveQuery(() => db.sessions.toArray());
  const settings = useLiveQuery(getSettings);
  const remarks = useLiveQuery(() => db.weekRemarks.toArray());
  const notes = useLiveQuery(() => db.exerciseNotes.toArray());
  const rotation = useLiveQuery(() => db.rotation.toArray());
  if (!sessions || !remarks || !notes || !rotation) return null;
  return <Ctx.Provider value={{ sessions, settings: settings ?? DEFAULT_SETTINGS, remarks, notes, rotation }}>{children}</Ctx.Provider>;
}
