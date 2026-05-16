import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type { SessionExercise } from './SessionExercise';

export class WorkoutSession extends Model {
  static table = 'workout_sessions';
  static associations = {
    session_exercises: { type: 'has_many' as const, foreignKey: 'session_id' },
  };

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('name') name!: string | null;
  @field('started_at') startedAt!: number;
  @field('ended_at') endedAt!: number | null;
  @field('notes') notes!: string | null;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;

  @children('session_exercises') sessionExercises!: Query<SessionExercise>;
}
