import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class PersonalRecord extends Model {
  static table = 'personal_records';

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('exercise_id') exerciseId!: string;
  @field('exercise_remote_id') exerciseRemoteId!: string | null;
  @field('rep_count') repCount!: number;
  @field('weight') weight!: number;
  @field('unit') unit!: 'lbs' | 'kg';
  @field('achieved_at') achievedAt!: number;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;
}
