import { Model } from '@nozbe/watermelondb';
import { field } from '@nozbe/watermelondb/decorators';
import type { MealType } from '@/lib/supabase/types';

export class FoodLog extends Model {
  static table = 'food_logs';

  @field('remote_id') remoteId!: string | null;
  @field('user_id') userId!: string;
  @field('food_id') foodId!: string | null;
  @field('food_remote_id') foodRemoteId!: string | null;
  @field('food_name') foodName!: string;
  @field('meal_type') mealType!: MealType;
  @field('serving_g') servingG!: number;
  @field('calories_kcal') caloriesKcal!: number;
  @field('protein_g') proteinG!: number;
  @field('carbs_g') carbsG!: number;
  @field('fat_g') fatG!: number;
  @field('logged_at') loggedAt!: number;
  @field('date') date!: string;
  @field('is_deleted') isDeleted!: boolean;
  @field('synced_at') syncedAt!: number | null;
}
