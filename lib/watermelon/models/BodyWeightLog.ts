import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class BodyWeightLog extends Model {
  static table = 'body_weight_logs';

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('weight') weight!: number;
  @field('unit') unit!: string;
  @field('logged_at') loggedAt!: number;
  @field('date') date!: string;
  @field('notes') notes!: string | null;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;
}
