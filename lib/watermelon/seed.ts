import { database } from './database';
import { supabase } from '@/lib/supabase/client';
import { EXERCISES } from '@/data/exercises';
import type { Exercise } from './models';

export async function seedExercisesIfNeeded(): Promise<void> {
  const collection = database.collections.get<Exercise>('exercises');
  const count = await collection.query().fetchCount();

  if (count === 0) {
    await initialSeed(collection);
    return;
  }

  // Always fill in any exercises that exist in the bundled data but not locally.
  // fillMissingExercises is a no-op when nothing is missing, so this is safe every launch.
  await fillMissingExercises(collection);
}

async function initialSeed(collection: any): Promise<void> {
  // Try to seed from Supabase so local IDs match remote UUIDs
  try {
    const { data, error } = await supabase
      .from('exercises')
      .select('id, name, muscle_primary, muscle_secondary, equipment, is_custom')
      .eq('is_custom', false)
      .limit(2000);

    if (!error && data && data.length > 0) {
      const now = Date.now();
      await database.write(async () => {
        const batch = data.map((row) =>
          collection.prepareCreate((record: Exercise) => {
            // Use Supabase UUID as the WatermelonDB local ID for consistent sync
            (record as any)._raw.id = row.id;
            record.remoteId = row.id;
            record.name = row.name;
            record.musclePrimaryRaw = JSON.stringify(row.muscle_primary ?? []);
            record.muscleSecondaryRaw = JSON.stringify(row.muscle_secondary ?? []);
            record.equipment = row.equipment ?? null;
            record.isCustom = false;
            record.createdBy = null;
            record.syncedAt = now;
          }),
        );
        await database.batch(batch);
      });
      return;
    }
  } catch {
    // Network unavailable — fall through to local seed
  }

  // Offline fallback: seed from bundled data (remoteId populated on next sync)
  await database.write(async () => {
    const batch = EXERCISES.map((ex) =>
      collection.prepareCreate((record: Exercise) => {
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
    await database.batch(batch);
  });
}

async function fillMissingExercises(collection: any): Promise<void> {
  const existing = await collection.query().fetch();
  const existingNames = new Set<string>(existing.map((ex: Exercise) => ex.name.toLowerCase()));

  const missing = EXERCISES.filter((ex) => !existingNames.has(ex.name.toLowerCase()));
  if (missing.length === 0) return;

  await database.write(async () => {
    const batch = missing.map((ex) =>
      collection.prepareCreate((record: Exercise) => {
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
    await database.batch(batch);
  });
}
