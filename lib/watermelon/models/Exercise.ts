import { Model } from '@nozbe/watermelondb';
import { field, readonly, date } from '@nozbe/watermelondb/decorators';

export class Exercise extends Model {
  static table = 'exercises';

  @field('remote_id') remoteId!: string | null;
  @field('name') name!: string;
  @field('muscle_primary') musclePrimaryRaw!: string;
  @field('muscle_secondary') muscleSecondaryRaw!: string;
  @field('equipment') equipment!: string | null;
  @field('is_custom') isCustom!: boolean;
  @field('created_by') createdBy!: string | null;
  @field('synced_at') syncedAt!: number | null;

  get musclePrimary(): string[] {
    try { return JSON.parse(this.musclePrimaryRaw); } catch { return []; }
  }

  get muscleSecondary(): string[] {
    try { return JSON.parse(this.muscleSecondaryRaw); } catch { return []; }
  }
}
