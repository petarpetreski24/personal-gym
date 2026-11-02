import { describe, expect, it } from 'vitest';
import { parseHevyText, pastedResult, replacedBy } from './hevyText.ts';
import { dayOfSession } from './engine.ts';
import { SEED_SESSIONS } from './seed/week1.ts';
import type { Session } from './types.ts';

// the text as copied from Hevy; the first workout's date was cut off
const PASTE = `Afternoon workout 💪
Duration
50m
Volume
5,041 kg
Records
1
0
0
Lat Pulldown (Cable)
SETS
WEIGHT & REPS
32kg x 10 reps
50kg x 8 reps
50kg x 8 reps
50kg x 8 reps
Bench Press (Barbell)
SETS
WEIGHT & REPS
50kg x 8 reps
52.5kg x 8 reps
52.5kg x 8 reps
Seated Cable Row - V Grip (Cable)
SETS
WEIGHT & REPS
52kg x 8 reps
52kg x 10 reps
52kg x 10 reps
Lateral Raise (Dumbbell)
SETS
WEIGHT & REPS
5kg x 15 reps
Best Volume
5kg x 15 reps
5kg x 15 reps
Overhead Triceps Extension (Cable)
SETS
WEIGHT & REPS
25kg x 8 reps
25kg x 8 reps
20kg x 10 reps

petarpetreski24
Oct 28, 2026, 7:12 PM
Evening workout 🏋️
Duration
1h 8m
Volume
6,082 kg
Records
3
0
0
Leg Press Horizontal (Machine)
SETS
WEIGHT & REPS
75kg x 10 reps
85kg x 12 reps
95kg x 8 reps
Romanian Deadlift (Barbell)
SETS
WEIGHT & REPS
53kg x 8 reps
53kg x 8 reps
53kg x 8 reps
Seated Leg Curl (Machine)
SETS
WEIGHT & REPS
40kg x 10 reps
50kg x 10 reps
55kg x 6 reps
Lateral Raise (Cable)
SETS
WEIGHT & REPS
5kg x 10 reps
5kg x 10 reps
5kg x 10 reps
Standing Calf Raise
SETS
REPS
15 reps
20 reps
20 reps
Triceps Pushdown
SETS
WEIGHT & REPS
20kg x 15 reps
Best Weight
Best Volume
Best 1 Rep Max
20kg x 15 reps
20kg x 15 reps

petarpetreski24
Yesterday at 6:03 PM
Evening workout 🏋️
Duration
59m
Volume
3,915 kg
Records
1
0
0
Incline Bench Press (Dumbbell)
SETS
WEIGHT & REPS
12.5kg x 10 reps
20kg x 8 reps
20kg x 6 reps
20kg x 8 reps
Overhead Press (Barbell)
SETS
WEIGHT & REPS
30kg x 8 reps
30kg x 8 reps
30kg x 8 reps
Seated Cable Row - V Grip (Cable)
SETS
WEIGHT & REPS
45kg x 10 reps
52kg x 10 reps
52kg x 10 reps
Butterfly (Pec Deck)
SETS
WEIGHT & REPS
35kg x 8 reps
35kg x 8 reps
35kg x 8 reps
Bicep Curl (Dumbbell)
SETS
WEIGHT & REPS
10kg x 10 reps
10kg x 11 reps
Best Volume
10kg x 9 reps
`;
const NOW = new Date(2026, 10, 2, 12, 0);
const parsed = parseHevyText(PASTE, NOW);
const plain = (s: Session) => s.exercises.map((e) => [e.exerciseId, e.sets.map((x) => [x.type, x.weightKg, x.reps])]);

describe('Hevy text', () => {
  it('reads every workout without warnings', () => {
    expect(parsed.map((w) => w.minutes)).toEqual([50, 68, 59]);
    expect(parsed.flatMap((w) => w.warnings)).toEqual([]);
  });
  it('reads dates, leaving a missing one blank', () => {
    expect(parsed.map((w) => w.start)).toEqual(['', '2026-10-28T19:12', '2026-11-01T18:03']);
  });
  it('gives the same sets and warm-ups as week 1', () => {
    const { sessions } = pastedResult(parsed, '2026-10-26');
    expect(sessions.map(plain)).toEqual(SEED_SESSIONS.map(plain));
    expect(parsed.map((w) => w.warmups)).toEqual([['Lat Pulldown (Cable) 32×10'], [], ['Incline Bench Press (Dumbbell) 12.5×10']]);
  });
  it('tells the program days and keeps unknown exercises', () => {
    const res = pastedResult(parsed.map((w) => ({ ...w, start: w.start || '2026-10-26T15:00' })), '2026-10-26');
    expect(res.sessions.map(dayOfSession)).toEqual(['upperA', 'lower', 'upperB']);
    expect(res.legacy.map((l) => l.name)).toEqual(['Butterfly (Pec Deck)']);
    expect(res.sessions[1].id).toBe('hevy:2026-10-28T19:12');
  });
  it('warns about what it could not read, and finds nothing in other text', () => {
    const [w] = parseHevyText('Run\nDuration\n20m\nVolume\n100 kg\nTreadmill\nSETS\nTIME\n20min\nCurl\nSETS\nWEIGHT & REPS\n10kg x 5 reps', NOW);
    expect(w.warnings).toContain('Not read: 20min');
    expect(w.warnings.some((x) => x.includes('Hevy says 100'))).toBe(true);
    expect(parseHevyText('hello\nworld', NOW)).toEqual([]);
  });
});

describe('replacing on paste', () => {
  const upperA = SEED_SESSIONS[0];
  const pasted = pastedResult([{ ...parsed[0], start: '2026-10-26T15:00' }], '2026-10-26').sessions;
  it('replaces the same program day on the same date', () => {
    expect(replacedBy([upperA, SEED_SESSIONS[1]], pasted).map((s) => s.id)).toEqual([upperA.id]);
  });
  it('keeps sessions edited here, and one with the same id', () => {
    expect(replacedBy([{ ...upperA, edited: true }], pasted)).toEqual([]);
    expect(replacedBy([{ ...upperA, id: pasted[0].id }], pasted)).toEqual([]);
  });
});
