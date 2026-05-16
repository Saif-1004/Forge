import { Model } from '@nozbe/watermelondb';
import { field, relation, children } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type { WorkoutSession } from './WorkoutSession';
import type { Exercise } from './Exercise';
import type { Set } from './Set';

export class SessionExercise extends Model {
  static table = 'session_exercises';
  static associations = {
    workout_sessions: { type: 'belongs_to' as const, key: 'session_id' },
    exercises: { type: 'belongs_to' as const, key: 'exercise_id' },
    sets: { type: 'has_many' as const, foreignKey: 'session_exercise_id' },
  };

  @field('remote_id') remoteId!: string | null;
  @field('session_id') sessionId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('exercise_remote_id') exerciseRemoteId!: string | null;
  @field('order_index') orderIndex!: number;
  @field('notes') notes!: string | null;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;

  @relation('workout_sessions', 'session_id') session!: WorkoutSession;
  @relation('exercises', 'exercise_id') exercise!: Exercise;
  @children('sets') sets!: Query<Set>;
}
