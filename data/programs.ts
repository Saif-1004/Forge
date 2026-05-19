export interface ProgramExercise {
  name: string;
  sets: number;
  reps: string; // e.g. "5" or "8-12" or "AMRAP"
  rest: string; // e.g. "3 min"
  notes?: string;
}

export interface ProgramDay {
  label: string; // "Day A" or "Push" or "Upper"
  focus: string; // short description
  exercises: ProgramExercise[];
}

export interface Program {
  id: string;
  name: string;
  description: string;
  frequency: string; // "3x / week"
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  goal: string;
  duration: string; // "8 weeks"
  days: ProgramDay[];
}

export const PROGRAMS: Program[] = [
  // ── StrongLifts 5×5 ───────────────────────────────────────────────────────
  {
    id: 'stronglifts_5x5',
    name: 'StrongLifts 5×5',
    description: 'The classic beginner strength program. Alternate Workout A and B three times a week. Add weight every session.',
    frequency: '3× / week',
    level: 'Beginner',
    goal: 'Strength',
    duration: '12 weeks',
    days: [
      {
        label: 'Workout A',
        focus: 'Squat · Bench · Row',
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5', rest: '3–5 min', notes: 'Add 2.5 kg every session' },
          { name: 'Barbell Bench Press', sets: 5, reps: '5', rest: '3–5 min', notes: 'Add 2.5 kg every session' },
          { name: 'Barbell Row', sets: 5, reps: '5', rest: '3–5 min', notes: 'Add 2.5 kg every session' },
        ],
      },
      {
        label: 'Workout B',
        focus: 'Squat · OHP · Deadlift',
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5', rest: '3–5 min', notes: 'Add 2.5 kg every session' },
          { name: 'Barbell Overhead Press', sets: 5, reps: '5', rest: '3–5 min', notes: 'Add 2.5 kg every session' },
          { name: 'Deadlift', sets: 1, reps: '5', rest: '5 min', notes: 'Add 5 kg every session' },
        ],
      },
    ],
  },

  // ── Push Pull Legs ────────────────────────────────────────────────────────
  {
    id: 'ppl',
    name: 'Push / Pull / Legs',
    description: 'The most popular intermediate split. Train 6 days a week — each muscle group gets trained twice. Focus on progressive overload.',
    frequency: '6× / week',
    level: 'Intermediate',
    goal: 'Hypertrophy',
    duration: 'Ongoing',
    days: [
      {
        label: 'Push',
        focus: 'Chest · Shoulders · Triceps',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Incline Dumbbell Bench Press', sets: 4, reps: '8–12', rest: '2 min' },
          { name: 'Cable Fly (Mid)', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Dumbbell Shoulder Press', sets: 4, reps: '8–12', rest: '2 min' },
          { name: 'Lateral Raise', sets: 4, reps: '15–20', rest: '60 sec' },
          { name: 'Tricep Pushdown', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Skull Crusher', sets: 3, reps: '10–12', rest: '90 sec' },
        ],
      },
      {
        label: 'Pull',
        focus: 'Back · Biceps · Rear Delts',
        exercises: [
          { name: 'Pull-Up', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Barbell Row', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Seated Cable Row', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Lat Pulldown', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Face Pull', sets: 3, reps: '15–20', rest: '60 sec' },
          { name: 'Barbell Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Hammer Curl', sets: 3, reps: '12–15', rest: '90 sec' },
        ],
      },
      {
        label: 'Legs',
        focus: 'Quads · Hamstrings · Glutes · Calves',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6–8', rest: '3 min' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8–10', rest: '2–3 min' },
          { name: 'Leg Press', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Leg Extension', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Leg Curl', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Hip Thrust', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Calf Raise', sets: 4, reps: '12–15', rest: '60 sec' },
        ],
      },
    ],
  },

  // ── Upper Lower ───────────────────────────────────────────────────────────
  {
    id: 'upper_lower',
    name: 'Upper / Lower',
    description: 'A balanced 4-day split hitting each muscle group twice a week. Great for building strength and size together.',
    frequency: '4× / week',
    level: 'Intermediate',
    goal: 'Strength & Hypertrophy',
    duration: 'Ongoing',
    days: [
      {
        label: 'Upper A',
        focus: 'Chest · Back · Shoulders · Arms',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Barbell Row', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Barbell Overhead Press', sets: 3, reps: '8–10', rest: '2 min' },
          { name: 'Lat Pulldown', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Dumbbell Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Tricep Pushdown', sets: 3, reps: '10–12', rest: '90 sec' },
        ],
      },
      {
        label: 'Lower A',
        focus: 'Quads · Hamstrings · Glutes',
        exercises: [
          { name: 'Barbell Back Squat', sets: 4, reps: '6–8', rest: '3 min' },
          { name: 'Romanian Deadlift', sets: 3, reps: '8–10', rest: '2–3 min' },
          { name: 'Leg Press', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Leg Curl', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Calf Raise', sets: 4, reps: '15', rest: '60 sec' },
        ],
      },
      {
        label: 'Upper B',
        focus: 'Back · Chest · Arms (volume)',
        exercises: [
          { name: 'Pull-Up', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Incline Dumbbell Bench Press', sets: 4, reps: '8–12', rest: '2 min' },
          { name: 'Seated Cable Row', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Barbell Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Skull Crusher', sets: 3, reps: '10–12', rest: '90 sec' },
        ],
      },
      {
        label: 'Lower B',
        focus: 'Posterior chain focus',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '4–6', rest: '3–4 min' },
          { name: 'Bulgarian Split Squat', sets: 3, reps: '8–10', rest: '2 min', notes: 'Per leg' },
          { name: 'Leg Extension', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Hip Thrust', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Seated Calf Raise', sets: 4, reps: '15', rest: '60 sec' },
        ],
      },
    ],
  },

  // ── Full Body ─────────────────────────────────────────────────────────────
  {
    id: 'full_body_3x',
    name: 'Full Body 3×',
    description: 'Three full-body sessions per week. Ideal for beginners or anyone returning after a break. Covers all major movement patterns each session.',
    frequency: '3× / week',
    level: 'Beginner',
    goal: 'General Fitness',
    duration: '8 weeks',
    days: [
      {
        label: 'Day A',
        focus: 'Squat · Press · Pull · Hinge',
        exercises: [
          { name: 'Barbell Back Squat', sets: 3, reps: '8', rest: '2–3 min' },
          { name: 'Barbell Bench Press', sets: 3, reps: '8', rest: '2 min' },
          { name: 'Barbell Row', sets: 3, reps: '8', rest: '2 min' },
          { name: 'Romanian Deadlift', sets: 3, reps: '10', rest: '2 min' },
          { name: 'Plank', sets: 3, reps: '30–60 sec', rest: '60 sec' },
        ],
      },
      {
        label: 'Day B',
        focus: 'Squat · OHP · Pull · Core',
        exercises: [
          { name: 'Goblet Squat', sets: 3, reps: '10', rest: '2 min' },
          { name: 'Barbell Overhead Press', sets: 3, reps: '8', rest: '2 min' },
          { name: 'Lat Pulldown', sets: 3, reps: '10', rest: '2 min' },
          { name: 'Dumbbell Row', sets: 3, reps: '10', rest: '2 min', notes: 'Per arm' },
          { name: 'Leg Raise', sets: 3, reps: '12', rest: '60 sec' },
        ],
      },
    ],
  },

  // ── Bro Split ─────────────────────────────────────────────────────────────
  {
    id: 'bro_split',
    name: 'Classic Bro Split',
    description: 'One muscle group per day. High volume per session, once per week frequency per muscle. Works best for intermediate-advanced lifters.',
    frequency: '5× / week',
    level: 'Intermediate',
    goal: 'Hypertrophy',
    duration: 'Ongoing',
    days: [
      {
        label: 'Chest',
        focus: 'Chest · Triceps',
        exercises: [
          { name: 'Barbell Bench Press', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Incline Dumbbell Bench Press', sets: 4, reps: '8–12', rest: '2 min' },
          { name: 'Decline Dumbbell Bench Press', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Dumbbell Flye', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Cable Crossover', sets: 3, reps: '15', rest: '60 sec' },
          { name: 'Skull Crusher', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Tricep Pushdown', sets: 3, reps: '12–15', rest: '60 sec' },
        ],
      },
      {
        label: 'Back',
        focus: 'Lats · Mid Back · Biceps',
        exercises: [
          { name: 'Deadlift', sets: 4, reps: '4–6', rest: '3–4 min' },
          { name: 'Pull-Up', sets: 4, reps: 'AMRAP', rest: '2–3 min' },
          { name: 'Barbell Row', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Seated Cable Row', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Lat Pulldown', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Barbell Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Hammer Curl', sets: 3, reps: '12', rest: '90 sec' },
        ],
      },
      {
        label: 'Shoulders',
        focus: 'All Three Delt Heads',
        exercises: [
          { name: 'Barbell Overhead Press', sets: 4, reps: '6–8', rest: '2–3 min' },
          { name: 'Dumbbell Shoulder Press', sets: 3, reps: '10–12', rest: '2 min' },
          { name: 'Lateral Raise', sets: 4, reps: '15–20', rest: '60 sec' },
          { name: 'Rear Delt Fly', sets: 4, reps: '15–20', rest: '60 sec' },
          { name: 'Face Pull', sets: 3, reps: '15–20', rest: '60 sec' },
          { name: 'Barbell Shrug', sets: 4, reps: '10–12', rest: '90 sec' },
        ],
      },
      {
        label: 'Arms',
        focus: 'Biceps · Triceps',
        exercises: [
          { name: 'Barbell Curl', sets: 4, reps: '8–10', rest: '90 sec' },
          { name: 'Incline Dumbbell Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Cable Curl', sets: 3, reps: '12–15', rest: '60 sec' },
          { name: 'Preacher Curl', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Skull Crusher', sets: 4, reps: '8–10', rest: '90 sec' },
          { name: 'Overhead Tricep Extension', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Tricep Dip', sets: 3, reps: 'AMRAP', rest: '90 sec' },
        ],
      },
      {
        label: 'Legs',
        focus: 'Quads · Hamstrings · Glutes · Calves',
        exercises: [
          { name: 'Barbell Back Squat', sets: 5, reps: '5–8', rest: '3 min' },
          { name: 'Leg Press', sets: 4, reps: '10–12', rest: '2 min' },
          { name: 'Leg Extension', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Romanian Deadlift', sets: 4, reps: '8–10', rest: '2 min' },
          { name: 'Leg Curl', sets: 3, reps: '12–15', rest: '90 sec' },
          { name: 'Hip Thrust', sets: 3, reps: '10–12', rest: '90 sec' },
          { name: 'Calf Raise', sets: 5, reps: '15', rest: '60 sec' },
        ],
      },
    ],
  },
];
