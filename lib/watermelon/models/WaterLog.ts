import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class WaterLog extends Model {
  static table = 'water_logs';

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('amount_ml') amountMl!: number;
  @field('logged_at') loggedAt!: number;
  @field('date') date!: string;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;
}
