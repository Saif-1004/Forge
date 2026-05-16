import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';

export class Food extends Model {
  static table = 'foods';

  @field('remote_id') remoteId!: string | null;
  @field('name') name!: string;
  @field('brand') brand!: string | null;
  @field('barcode') barcode!: string | null;
  @field('calories_per_100g') caloriesPer100g!: number;
  @field('protein_per_100g') proteinPer100g!: number;
  @field('carbs_per_100g') carbsPer100g!: number;
  @field('fat_per_100g') fatPer100g!: number;
  @field('is_custom') isCustom!: boolean;
  @field('created_by') createdBy!: string | null;
  @field('synced_at') syncedAt!: number | null;
}
