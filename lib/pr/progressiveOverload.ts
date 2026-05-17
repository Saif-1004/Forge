import { Q } from '@nozbe/watermelondb';
import { database } from '@/lib/watermelon/database';
import type { WorkoutSession, SessionExercise, Set as SetModel, Exercise } from '@/lib/watermelon/models';

export interface OverloadSuggestion {
  exerciseId: string;
  exerciseName: string;
  currentWeight: number;
  suggestedWeight: number;
  unit: string;
  reps: number;
  sessionsHit: number; // how many consecutive sessions the target was met
}

const INCREMENT_KG = 2.5;
const INCREMENT_LBS = 5;
const MIN_SESSIONS_TO_SUGGEST = 2; // must hit target reps for this many sessions
const TOP_SET_TARGET_REPS = 8; // if avg top-set reps >= this, suggest increase

/**
 * Checks the last N sessions for a given exercise and returns a suggestion
 * if the user has consistently hit their top-set reps.
 */
async function checkExercise(
  exerciseId: string,
  exerciseName: string,
  userId: string,
): Promise<OverloadSuggestion | null> {
  const sessCol = database.collections.get<WorkoutSession>('workout_sessions');
  const seCol = database.collections.get<SessionExercise>('session_exercises');
  const setsCol = database.collections.get<SetModel>('sets');

  // Find the last 4 completed sessions
  const recentSessions = await sessCol
    .query(
      Q.where('user_id', userId),
      Q.where('is_deleted', false),
      Q.where('ended_at', Q.notEq(null)),
      Q.sortBy('started_at', Q.desc),
    )
    .fetch();

  const results: { reps: number; weight: number; unit: string }[] = [];

  for (const sess of recentSessions.slice(0, 6)) {
    const ses = await seCol
      .query(Q.where('session_id', sess.id), Q.where('exercise_id', exerciseId), Q.where('is_deleted', false))
      .fetch();
    if (ses.length === 0) continue;

    const setsRaw = await setsCol
      .query(Q.where('session_exercise_id', ses[0].id), Q.where('is_deleted', false))
      .fetch();

    const workingSets = setsRaw.filter((s) => !s.isWarmup && s.reps > 0 && s.weight > 0);
    if (workingSets.length === 0) continue;

    // Top set = max weight in the session
    workingSets.sort((a, b) => b.weight - a.weight);
    const topSet = workingSets[0];
    results.push({ reps: topSet.reps, weight: topSet.weight, unit: topSet.unit });

    if (results.length >= 4) break;
  }

  if (results.length < MIN_SESSIONS_TO_SUGGEST) return null;

  // Check if the last MIN_SESSIONS consecutive sessions all hit target reps
  const recent = results.slice(0, MIN_SESSIONS_TO_SUGGEST);
  const allHit = recent.every((r) => r.reps >= TOP_SET_TARGET_REPS);
  if (!allHit) return null;

  // Check they're all at the same weight (not already progressively increasing)
  const weights = recent.map((r) => r.weight);
  const allSameWeight = weights.every((w) => w === weights[0]);
  if (!allSameWeight) return null;

  const currentWeight = recent[0].weight;
  const unit = recent[0].unit;
  const increment = unit === 'lbs' ? INCREMENT_LBS : INCREMENT_KG;

  return {
    exerciseId,
    exerciseName,
    currentWeight,
    suggestedWeight: Math.round((currentWeight + increment) * 10) / 10,
    unit,
    reps: recent[0].reps,
    sessionsHit: MIN_SESSIONS_TO_SUGGEST,
  };
}

/**
 * Returns progressive overload suggestions for exercises done in the most recent session.
 */
export async function getOverloadSuggestions(userId: string): Promise<OverloadSuggestion[]> {
  try {
    const sessCol = database.collections.get<WorkoutSession>('workout_sessions');
    const seCol = database.collections.get<SessionExercise>('session_exercises');
    const exCol = database.collections.get<Exercise>('exercises');

    const lastSession = await sessCol
      .query(
        Q.where('user_id', userId),
        Q.where('is_deleted', false),
        Q.where('ended_at', Q.notEq(null)),
        Q.sortBy('started_at', Q.desc),
      )
      .fetch();

    if (!lastSession[0]) return [];

    const sessionExercises = await seCol
      .query(Q.where('session_id', lastSession[0].id), Q.where('is_deleted', false))
      .fetch();

    const suggestions: OverloadSuggestion[] = [];

    for (const se of sessionExercises) {
      let exName = 'Unknown';
      try {
        const ex = await exCol.find(se.exerciseId);
        if (ex.musclePrimary.includes('cardio')) continue;
        exName = ex.name;
      } catch { continue; }

      const suggestion = await checkExercise(se.exerciseId, exName, userId);
      if (suggestion) suggestions.push(suggestion);
    }

    return suggestions;
  } catch {
    return [];
  }
}
