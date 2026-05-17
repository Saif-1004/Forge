import { Q } from '@nozbe/watermelondb';
import { database } from '@/lib/watermelon/database';
import type { PersonalRecord } from '@/lib/watermelon/models';

/**
 * Checks whether a logged set is a new PR for the given exercise + rep count.
 * If it is, upserts the personal_records row and returns true.
 * Warmup sets should be filtered out before calling this.
 */
export async function checkAndUpdatePR(
  userId: string,
  exerciseId: string,
  exerciseRemoteId: string | null,
  reps: number,
  weight: number,
  unit: 'kg' | 'lbs',
): Promise<boolean> {
  if (reps <= 0 || weight <= 0) return false;

  const prCol = database.collections.get<PersonalRecord>('personal_records');

  const existing = await prCol
    .query(
      Q.where('user_id', userId),
      Q.where('exercise_id', exerciseId),
      Q.where('rep_count', reps),
      Q.where('is_deleted', false),
    )
    .fetch();

  const currentBest = existing[0] ?? null;

  if (!currentBest) {
    // First time at this rep count — always a PR
    await database.write(async () => {
      await prCol.create((record) => {
        record.userId = userId;
        record.exerciseId = exerciseId;
        record.exerciseRemoteId = exerciseRemoteId;
        record.repCount = reps;
        record.weight = weight;
        record.unit = unit;
        record.achievedAt = Date.now();
        record.isDeleted = false;
        record.remoteId = null;
        record.syncedAt = null;
      });
    });
    return true;
  }

  if (weight > currentBest.weight) {
    await database.write(async () => {
      await currentBest.update((record) => {
        record.weight = weight;
        record.unit = unit;
        record.achievedAt = Date.now();
        record.syncedAt = null;
      });
    });
    return true;
  }

  return false;
}
