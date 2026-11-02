import type { SetLog } from './types.ts';
import { workingSets } from './engine.ts';

/** Typed number, accepting a decimal comma (52,5). Empty or unreadable gives null, never NaN. */
export function parseNum(v: string): number | null {
  const n = Number(v.trim().replace(',', '.'));
  return v.trim() === '' || !Number.isFinite(n) ? null : n;
}
export const fmtNum = (n: number | null | undefined) => (n == null ? '–' : String(Math.round(n * 100) / 100));
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtDay = (d: Date) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
export const fmtSets = (sets: SetLog[]) =>
  workingSets(sets).map((s) => (s.weightKg ? `${fmtNum(s.weightKg)}×${s.reps}` : `BW×${s.reps}`)).join(', ');
export const fmtMins = (ms: number) => `${Math.round(ms / 60000)} min`;
export const mmss = (sec: number) => `${Math.floor(sec / 60)}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
export const MUSCLE_NAME = (m: string) => m.replace(/_/g, ' ');
export const newId = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
export function download(name: string, text: string, type = 'application/json') {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
