import type { ExerciseNote, Session, SessionExercise, SetLog, WeekRemark } from '../types.ts';

/** "W 32x10" -> warm-up, plain pairs are working sets. weight null = bodyweight. */
function sets(...s: ([number | null, number] | ['W', number, number])[]): SetLog[] {
  return s.map((t, i) =>
    t[0] === 'W'
      ? { index: i, type: 'warmup', weightKg: t[1], reps: t[2] }
      : { index: i, type: 'working', weightKg: t[0], reps: t[1] },
  );
}
const ex = (exerciseId: string, slotId: string | undefined, s: SetLog[], extra?: Partial<SessionExercise>): SessionExercise =>
  ({ exerciseId, slotId, sets: s, ...(slotId ? {} : { extra: true }), ...extra });

const mk = (id: string, dayId: Session['dayId'], title: string, start: string, mins: number, exercises: SessionExercise[]): Session => ({
  id, dayId, title, weekNumber: 1, source: 'seed', startedAt: new Date(start).toISOString(),
  endedAt: new Date(new Date(start).getTime() + mins * 60000).toISOString(), exercises,
});

export const SEED_SESSIONS: Session[] = [
  mk('seed-w1-upperA', 'upperA', 'Upper A', '2026-10-26T18:30:00', 50, [
    ex('bench-press-barbell', 'A1', sets([50, 8], [52.5, 8], [52.5, 8])),
    ex('lat-pulldown', 'A2', sets(['W', 32, 10], [50, 8], [50, 8], [50, 8])),
    ex('seated-cable-row-v', 'A3', sets([52, 8], [52, 10], [52, 10])),
    ex('db-lateral-raise', 'A4a', sets([5, 15], [5, 15], [5, 15])),
    ex('overhead-cable-triceps-ext', 'A4b', sets([25, 8], [25, 8], [20, 10])),
  ]),
  mk('seed-w1-lower', 'lower', 'Lower', '2026-10-28T19:12:00', 68, [
    ex('rdl-barbell', 'L1', sets([53, 8], [53, 8], [53, 8])),
    ex('leg-press-horizontal', 'L2', sets([75, 10], [85, 12], [95, 8])),
    ex('seated-leg-curl', 'L3', sets([40, 10], [50, 10], [55, 6])),
    ex('standing-calf-raise', 'L4a', sets([null, 15], [null, 20], [null, 20])),
    ex('single-arm-cable-lateral', 'L5a', sets([5, 10], [5, 10], [5, 10])),
    ex('rope-pushdown', undefined, sets([20, 15])),
  ]),
  mk('seed-w1-upperB', 'upperB', 'Upper B', '2026-10-30T18:03:00', 59, [
    ex('overhead-press-barbell', 'B1', sets([30, 8], [30, 8], [30, 8])),
    ex('incline-db-press', 'B2', sets(['W', 12.5, 10], [20, 8], [20, 6], [20, 8])),
    ex('seated-cable-row-v', undefined, sets([45, 10], [52, 10], [52, 10])),
    ex('legacy-butterfly-pec-deck', undefined, sets([35, 8], [35, 8], [35, 8]), { note: 'Shoulder burn, not chest. Replaced by cable fly rotation' }),
    ex('db-curl', 'B5a', sets([10, 10], [10, 11], [10, 9])),
  ]),
];

export const SEED_LEGACY = [{ id: 'legacy-butterfly-pec-deck', name: 'Butterfly (Pec Deck)', type: 'isolation' as const }];

export const SEED_REMARKS: WeekRemark[] = [{
  weekNumber: 1,
  text: `Good first week. Bench 52.5 × 8 (up from 52.5 × 6). Cable row +2 reps per set at 52 kg. OHP held 30 × 8 on all sets.

Fix next week:
- Use straight sets instead of pyramiding to a heavy top set on leg press and leg curl.
- Leg press stays at 85 kg.
- Overhead triceps extension is too heavy at 25 kg; use 20 kg.
- Cable lateral raise at 5 kg is too heavy; use the lightest stack step.
- Calf raises need load.
- The lower day ran 68 min; supersets and fewer warm-up pyramids should fix that.

Gym has no chest-supported row, so it was replaced by the one-arm DB row. Pec deck caused shoulder burn and was replaced by the cable fly rotation.`,
}];

const FLY_NOTE = 'Pec deck gave shoulder burn; keep elbows below shoulders.';
export const SEED_NOTES: ExerciseNote[] = [
  { exerciseId: 'leg-press-horizontal', text: 'Maintenance. 85 kg, straight sets, 2–3 reps left.' },
  { exerciseId: 'seated-cable-fly', text: FLY_NOTE },
  { exerciseId: 'low-to-high-cable-fly', text: FLY_NOTE },
  { exerciseId: 'flat-db-fly', text: FLY_NOTE },
];
