import { Database } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { schema } from './schema';
import { migrations } from './migrations';
import {
  Exercise,
  WorkoutSession,
  SessionExercise,
  Set,
  PersonalRecord,
  FoodLog,
  WaterLog,
  Food,
} from './models';

const adapter = new SQLiteAdapter({
  schema,
  migrations,
  dbName: 'pumps',
  jsi: true,
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
    PersonalRecord,
    FoodLog,
    WaterLog,
    Food,
  ],
});

export type AppDatabase = typeof database;
