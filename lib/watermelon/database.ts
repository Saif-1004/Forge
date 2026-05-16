import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import {
  Exercise,
  WorkoutSession,
  SessionExercise,
  Set,
  FoodLog,
  WaterLog,
  Food,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  dbName: 'pumps',
  jsi: true,      // Use JSI for ~10x faster SQLite on RN (requires JSI setup in native)
  onSetUpError: (error) => {
    console.error('[WatermelonDB] Setup error:', error);
  },
});

export const database = new Database({
  adapter,
  modelClasses: [
    Exercise,
    WorkoutSession,
    SessionExercise,
    Set,
    FoodLog,
    WaterLog,
    Food,
  ],
});

export type AppDatabase = typeof database;
