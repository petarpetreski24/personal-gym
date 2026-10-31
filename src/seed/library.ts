import type { Exercise, ExerciseType, LoadType, Muscle } from '../types.ts';

const FLY_CUE = 'Elbows soft and below shoulder height, shoulder blades pinned back, stop when the stretch is in the chest, not the front of the shoulder. If it still bothers you, swap this week to 2 sets of machine chest press.';

type Opt = { perSide?: boolean; equipment?: string; mistakes?: string[] };
function x(
  id: string, name: string, type: ExerciseType, loadType: LoadType,
  primary: Muscle[], secondary: Muscle[], hevyNames: string[],
  description: string, cues: string[] = [], o: Opt = {},
): Exercise {
  return { id, name, type, loadType, primary, secondary, hevyNames, description, cues, ...o };
}
const C = 'compound', I = 'isolation';

export const LIBRARY: Exercise[] = [
  // Fixed compounds
  x('bench-press-barbell', 'Bench Press (Barbell)', C, 'barbell', ['chest'], ['triceps', 'front_delts'], ['Bench Press (Barbell)'], 'Flat barbell press.', ['Shoulder blades pinned back and down', 'Bar touches the lower chest', 'Feet planted', 'Press up and slightly back']),
  x('lat-pulldown', 'Lat Pulldown (Cable)', C, 'cable', ['lats_upper_back'], ['biceps', 'rear_delts'], ['Lat Pulldown (Cable)'], 'Vertical pull.', ['Grip slightly wider than the shoulders', 'Chest up', 'Pull the elbows down to the ribs', 'Full stretch at the top', 'No swinging']),
  x('seated-cable-row-v', 'Seated Cable Row – V Grip', C, 'cable', ['lats_upper_back'], ['biceps', 'rear_delts'], ['Seated Cable Row - V Grip (Cable)'], 'Horizontal pull.', ['Tall torso', 'Let the shoulders reach forward for the stretch', 'Pull to the lower ribs', 'No rocking']),
  x('overhead-press-barbell', 'Overhead Press (Barbell)', C, 'barbell', ['front_delts', 'side_delts'], ['triceps'], ['Overhead Press (Barbell)'], 'Standing press.', ['Glutes and abs tight', 'Bar travels close to the face', 'Head moves through at the top', 'No back arch']),
  x('incline-db-press', 'Incline Bench Press (Dumbbell)', C, 'dumbbell', ['chest'], ['front_delts', 'triceps'], ['Incline Bench Press (Dumbbell)'], 'Bench at 30–45°.', ['DBs lower to the upper chest', 'Elbows about 45° from the body', 'Deep stretch', 'Press up and slightly in']),
  x('one-arm-db-row', 'One-Arm Dumbbell Row (bench-supported)', C, 'dumbbell', ['lats_upper_back'], ['biceps', 'rear_delts'], ['Dumbbell Row'], 'One knee and hand on the bench.', ['Flat back', 'Pull the DB toward the hip', 'Full stretch at the bottom', "Don't twist the torso"], { perSide: true }),
  x('rdl-barbell', 'Romanian Deadlift (Barbell)', C, 'barbell', ['hamstrings', 'glutes'], ['lats_upper_back'], ['Romanian Deadlift (Barbell)'], 'Hip hinge.', ['Soft knees', 'Push the hips back', 'Bar slides down the thighs', 'Stop when the hamstrings are stretched and the back is still flat', 'Stop 2–3 reps before failure']),
  x('leg-press-horizontal', 'Leg Press Horizontal (Machine)', C, 'machine', ['quads', 'glutes'], ['hamstrings'], ['Leg Press Horizontal (Machine)'], 'Maintenance only; load locked at 85 kg.', ['Feet mid-to-high on the plate', 'Lower until the hips start to lift, then stop', 'No pyramiding']),
  x('chest-press-machine', 'Chest Press (Machine)', C, 'machine', ['chest'], ['triceps', 'front_delts'], ['Chest Press (Machine)'], 'Machine press.', ['Handles at mid-chest height', 'Shoulder blades back', 'Controlled stretch']),
  x('assisted-pull-up', 'Assisted Pull-up', C, 'machine', ['lats_upper_back'], ['biceps'], ['Pull Up (Assisted)'], 'Logged weight is the assistance: less assistance = harder.', ['Full hang at the bottom', 'Chest toward the bar', 'Reduce the assistance over time']),

  // Rotating isolations
  x('db-lateral-raise', 'Lateral Raise (Dumbbell)', I, 'dumbbell', ['side_delts'], [], ['Lateral Raise (Dumbbell)'], 'Standing dumbbell lateral raise.', ['Slight forward lean', 'Lead with the elbows', 'Raise to shoulder height', 'No swinging']),
  x('seated-db-lateral-raise', 'Seated Lateral Raise (Dumbbell)', I, 'dumbbell', ['side_delts'], [], ['Seated Lateral Raise (Dumbbell)'], "Seated at the end of a bench so the legs can't help. Expect fewer reps than standing."),
  x('lean-away-db-lateral-raise', 'Lean-away Lateral Raise', I, 'dumbbell', ['side_delts'], [], [], 'Hold a post, lean out about 20°, one arm at a time. The bottom of the lift gets harder.', [], { perSide: true }),
  x('single-arm-cable-lateral', 'Single-arm Cable Lateral Raise', I, 'cable', ['side_delts'], [], ['Lateral Raise (Cable)', 'Single Arm Lateral Raise (Cable)'], 'Low pulley with the cable behind the body; constant tension. A cable feels much heavier than a DB of the same number, so start at the lightest step.', [], { perSide: true }),
  x('cable-y-raise', 'Cable Y-Raise', I, 'cable', ['side_delts'], ['rear_delts'], [], 'Two low pulleys crossed; raise up and out into a Y, thumbs up.'),
  x('side-lying-incline-lateral', 'Side-lying Incline Lateral Raise', I, 'dumbbell', ['side_delts'], [], [], 'Lie on your side on a 30–45° bench and raise the top arm. Very light DB, big stretch at the bottom.', [], { perSide: true, equipment: 'incline bench' }),
  x('cable-rear-delt-fly', 'Cable Rear Delt Fly', I, 'cable', ['rear_delts'], [], ['Rear Delt Reverse Fly (Cable)'], 'Cables at shoulder height, crossed (left hand holds the right cable); pull out wide with straight arms.'),
  x('rope-face-pull', 'Face Pull (Rope)', I, 'cable', ['rear_delts'], ['lats_upper_back'], ['Face Pull'], 'Rope at forehead height; pull to the face; elbows high; hands finish beside the ears.'),
  x('reverse-pec-deck', 'Reverse Pec Deck', I, 'machine', ['rear_delts'], [], ['Rear Delt Reverse Fly (Machine)'], 'Face the pad, handles at shoulder height, sweep the arms back; let the delts do it rather than squeezing the shoulder blades.', [], { equipment: 'reverse pec deck' }),
  x('overhead-cable-triceps-ext', 'Overhead Triceps Extension (Cable)', I, 'cable', ['triceps'], [], ['Overhead Triceps Extension (Cable)'], 'Face away from the pulley; elbows by the head; deep stretch behind; full extension. Overhead work grew the triceps about 1.5× more than pushdowns in a 12-week study (Maeo et al., 2023).'),
  x('single-arm-oh-db-ext', 'Single-arm Overhead DB Extension', I, 'dumbbell', ['triceps'], [], ['Single Arm Triceps Extension (Dumbbell)'], 'Seated, elbow pointing up, lower the DB behind the head until the triceps stretch.', [], { perSide: true }),
  x('ez-skull-crusher-behind-head', 'EZ-bar Skull Crusher (behind head)', I, 'barbell', ['triceps'], [], ['Skullcrusher (Barbell)'], 'Lying; lower the bar behind the top of the head, not to the forehead; upper arms angled slightly back.'),
  x('two-hand-oh-db-ext', 'Overhead DB Extension (two hands)', I, 'dumbbell', ['triceps'], [], ['Triceps Extension (Dumbbell)'], 'Hold one DB by the plate end with both hands, seated; same deep stretch.'),
  x('cable-cross-body-ext', 'Cable Cross-body Triceps Extension', I, 'cable', ['triceps'], [], [], 'Two cables at head height, arms crossed, extend out to the sides. Easy on the elbows.'),
  x('rope-pushdown', 'Triceps Pushdown (Rope)', I, 'cable', ['triceps'], [], ['Triceps Pushdown', 'Triceps Rope Pushdown'], 'Elbows pinned at the sides; spread the rope at the bottom; full lockout.'),
  x('v-bar-pushdown', 'V-Bar Pushdown', I, 'cable', ['triceps'], [], [], "Like the rope but heavier; slight forward lean; don't let the shoulders roll in."),
  x('single-arm-reverse-pushdown', 'Single-arm Reverse-grip Pushdown', I, 'cable', ['triceps'], [], [], 'Palm up on a D-handle, one arm at a time. Lighter; fixes left/right differences.', [], { perSide: true }),
  x('db-curl', 'Bicep Curl (Dumbbell)', I, 'dumbbell', ['biceps'], [], ['Bicep Curl (Dumbbell)'], 'Palms up; elbows still; lower over 2 s.'),
  x('incline-db-curl', 'Incline Dumbbell Curl', I, 'dumbbell', ['biceps'], [], ['Incline Curl (Dumbbell)'], 'Bench at 45–60°, arms hang straight down behind the body; long stretch; lighter than standing.'),
  x('bayesian-cable-curl', 'Bayesian Cable Curl', I, 'cable', ['biceps'], [], [], 'Face away from a low pulley with the arm behind the body; curl forward; stretch at the bottom.', [], { perSide: true }),
  x('ez-bar-curl', 'EZ Bar Biceps Curl', I, 'barbell', ['biceps'], [], ['EZ Bar Biceps Curl'], 'Grip on the angled parts, easier on the wrists; the heaviest curl option.'),
  x('hammer-curl', 'Hammer Curl (Dumbbell)', I, 'dumbbell', ['biceps', 'forearms'], [], ['Hammer Curl (Dumbbell)'], 'Palms facing each other; works the brachialis and forearm.'),
  x('preacher-curl', 'Preacher Curl', I, 'barbell', ['biceps'], [], ['Preacher Curl (Barbell)', 'Preacher Curl (Machine)'], "Arm on the pad; don't lock out hard at the bottom; strict."),
  x('seated-cable-fly', 'Seated Cable Fly', I, 'cable', ['chest'], [], ['Seated Chest Flys (Cable)', 'Cable Fly Crossovers'], 'Bench between the cables, pulleys at chest height; elbows soft and below the shoulders; hug the cables in.', [FLY_CUE]),
  x('low-to-high-cable-fly', 'Low-to-High Cable Fly', I, 'cable', ['chest'], ['front_delts'], ['Low Cable Fly Crossovers'], 'Pulleys low; sweep up to chin height. Upper chest; usually the friendliest on the shoulders.', [FLY_CUE]),
  x('flat-db-fly', 'Flat Dumbbell Fly', I, 'dumbbell', ['chest'], [], ['Chest Fly (Dumbbell)'], 'Soft elbows; lower until the stretch is in the chest, not the shoulder; bring the DBs up.', [FLY_CUE]),
  x('seated-leg-curl', 'Seated Leg Curl (Machine)', I, 'machine', ['hamstrings'], [], ['Seated Leg Curl (Machine)'], 'Lean the torso slightly forward for more stretch. Grew the hamstrings more than lying curls in one study (Maeo et al., 2021).'),
  x('single-leg-seated-curl', 'Single-leg Seated Leg Curl', I, 'machine', ['hamstrings'], [], ['Single Leg Curl'], 'One leg at a time; evens out strength between legs.', [], { perSide: true }),
  x('lying-leg-curl', 'Lying Leg Curl (Machine)', I, 'machine', ['hamstrings'], [], ['Lying Leg Curl (Machine)'], 'Hips pressed into the pad; curl without lifting the hips.', [], { equipment: 'lying leg curl' }),
  x('standing-calf-raise', 'Standing Calf Raise', I, 'machine', ['calves'], [], ['Standing Calf Raise (Machine)', 'Standing Calf Raise', 'Standing Calf Raise (Dumbbell)'], 'Must be loaded (machine, or a DB in hand on a step). 1 s pause in the bottom stretch; full rise.'),
  x('leg-press-calf-press', 'Calf Press on Leg Press', I, 'machine', ['calves'], [], ['Calf Press on Leg Press'], 'Balls of the feet on the bottom edge of the plate; knees straight but not locked.'),
  x('single-leg-db-calf-raise', 'Single-leg DB Calf Raise', I, 'dumbbell', ['calves'], [], ['Single Leg Standing Calf Raise'], 'One foot on a step; DB held on the working side.', [], { perSide: true }),
  x('cable-crunch', 'Cable Crunch', I, 'cable', ['core'], [], ['Cable Crunch'], 'Kneel with the rope by the head; curl the spine down; the hips don\'t move.'),
  x('hanging-knee-raise', 'Hanging Knee Raise', I, 'bodyweight', ['core'], [], ['Hanging Knee Raise'], 'No swinging; curl the pelvis up at the top; progress to straight legs.'),
  x('pallof-press', 'Pallof Press', I, 'cable', ['core'], [], ['Pallof Press'], 'Side-on to a chest-height cable; press straight out and resist the twist; reps are per side.', [], { perSide: true }),

  // Optional extra
  x('nordic-curl', 'Nordic Hamstring Curl', I, 'bodyweight', ['hamstrings'], [], ['Nordic Hamstring Curl'], '2 × 3–6 slow lowerings. Strongly protective against hamstring strains (van Dyk et al., 2019).'),
];

export const LIB: Record<string, Exercise> = Object.fromEntries(LIBRARY.map((e) => [e.id, e]));

export const LEGACY_TITLES = [
  'Bent Over Row (Dumbbell)', 'Bicep Curl (Cable)', 'Butterfly (Pec Deck)', 'Deadlift (Barbell)',
  'Incline Bench Press (Barbell)', 'Iso-Lateral Row (Machine)', 'Leg Extension (Machine)',
  'Romanian Deadlift (Dumbbell)', 'Seated Calf Raise', 'Seated Shoulder Press (Machine)',
  'Shoulder Press (Dumbbell)', 'Shoulder Press (Machine Plates)', 'Shoulder Press Machine (stronger)',
  'Squat (Dumbbell)', 'Back Extension (Weighted Hyperextension)',
];
