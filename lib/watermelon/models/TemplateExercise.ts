import { Model } from '@nozbe/watermelondb';
import { field, relation } from '@nozbe/watermelondb/decorators';
import type { WorkoutTemplate } from './WorkoutTemplate';

export class TemplateExercise extends Model {
  static table = 'template_exercises';
  static associations = {
    workout_templates: { type: 'belongs_to' as const, key: 'template_id' },
  };

  @field('remote_id') remoteId!: string | null;
  @field('template_id') templateId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('order_index') orderIndex!: number;
  @field('default_sets') defaultSets!: number;
  @field('default_reps') defaultReps!: number;
  @field('default_weight') defaultWeight!: number;
  @field('default_unit') defaultUnit!: string;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;

  @relation('workout_templates', 'template_id') template!: WorkoutTemplate;
}
