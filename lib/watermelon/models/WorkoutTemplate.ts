import { Model } from '@nozbe/watermelondb';
import { field, children } from '@nozbe/watermelondb/decorators';
import type { Query } from '@nozbe/watermelondb';
import type { TemplateExercise } from './TemplateExercise';

export class WorkoutTemplate extends Model {
  static table = 'workout_templates';
  static associations = {
    template_exercises: { type: 'has_many' as const, foreignKey: 'template_id' },
  };

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('name') name!: string;
  @field('notes') notes!: string | null;
  @field('created_at') createdAt!: number;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;

  @children('template_exercises') templateExercises!: Query<TemplateExercise>;
}
