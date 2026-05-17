import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { SessionExercise } from './SessionExercise';

export class Set extends Model {
  static table = 'sets';
  static associations = {
    session_exercises: { type: 'belongs_to' as const, key: 'session_exercise_id' },
  };

  @field('remote_id') remoteId!: string | null;
  @field('session_exercise_id') sessionExerciseId!: string;
  @field('set_number') setNumber!: number;
  @field('reps') reps!: number;
  @field('weight') weight!: number;
  @field('unit') unit!: 'lbs' | 'kg';
  @field('rpe') rpe!: number | null;
  @field('is_warmup') isWarmup!: boolean;
  @field('duration_seconds') durationSeconds!: number | null;
  @field('completed_at') completedAt!: number;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;

  @relation('session_exercises', 'session_exercise_id') sessionExercise!: SessionExercise;
}
