import { Q } from '@nozbe/watermelondb';
import { database } from '@/lib/watermelon/database';
import type { Exercise } from '@/lib/watermelon/models';

export const MUSCLE_MAP: Record<string, string[]> = {
  Chest: ['chest'],
  Back: ['lats', 'mid_back', 'lower_back', 'traps'],
  Shoulders: ['front_delt', 'mid_delt', 'rear_delt'],
  Arms: ['biceps', 'triceps', 'brachialis'],
  Legs: ['quads', 'hamstrings', 'calves'],
  Glutes: ['glutes'],
  Core: ['core', 'obliques'],
  Cardio: ['cardio'],
  'Full Body': ['chest', 'lats', 'quads', 'glutes', 'core'],
};

export interface ExerciseSuggestion {
  id: string;
  name: string;
  group: string;
}

export async function suggestExercises(muscleGroups: string[]): Promise<ExerciseSuggestion[]> {
  if (muscleGroups.length === 0) return [];
  const exCol = database.collections.get<Exercise>('exercises');
  const all = await exCol.query(Q.where('is_custom', false)).fetch();

  const result: ExerciseSuggestion[] = [];
  for (const group of muscleGroups) {
    const keys = MUSCLE_MAP[group] ?? [];
    if (keys.length === 0) continue;
    const matching = all.filter(ex => ex.musclePrimary.some(m => keys.includes(m)));
    for (const ex of matching) result.push({ id: ex.id, name: ex.name, group });
  }
  return result;
}

export async function exerciseNamesByIds(ids: string[]): Promise<Record<string, string>> {
  if (ids.length === 0) return {};
  const exCol = database.collections.get<Exercise>('exercises');
  const found = await Promise.allSettled(ids.map(id => exCol.find(id)));
  const map: Record<string, string> = {};
  for (let i = 0; i < ids.length; i++) {
    const r = found[i];
    if (r.status === 'fulfilled') map[ids[i]] = r.value.name;
  }
  return map;
}
