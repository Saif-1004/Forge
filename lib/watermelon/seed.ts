import { database } from './database';
import { EXERCISES } from '@/data/exercises';
import type { Exercise } from './models';

export async function seedExercisesIfNeeded(): Promise<void> {
  const collection = database.collections.get<Exercise>('exercises');
  const count = await collection.query().fetchCount();
  if (count > 0) return;

  await database.write(async () => {
    const batch = EXERCISES.map((ex) =>
      collection.prepareCreate((record) => {
        record.remoteId = null;
        record.name = ex.name;
        record.musclePrimaryRaw = JSON.stringify(ex.muscle_primary);
        record.muscleSecondaryRaw = JSON.stringify(ex.muscle_secondary);
        record.equipment = ex.equipment;
        record.isCustom = false;
        record.createdBy = null;
        record.syncedAt = null;
      }),
    );
    await database.batch(...batch);
  });
}
