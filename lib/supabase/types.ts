export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

export type UnitSystem = 'imperial' | 'metric';
export type Gender = 'male' | 'female' | 'unspecified';
export type ExperienceLevel = 'beginner' | 'novice' | 'intermediate' | 'advanced';
export type PrimaryGoal = 'muscle' | 'fat_loss' | 'endurance' | 'athletic' | 'consistency';
export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';
export type JobStatus = 'pending' | 'processing' | 'done' | 'failed';
export type EntitlementTier = 'base' | 'ai';
export type TeamRole = 'admin' | 'member';

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          display_name: string | null;
          unit_system: UnitSystem;
          unit_preference: 'lbs' | 'kg';
          gender: Gender | null;
          date_of_birth: string | null;
          height_cm: number | null;
          weight_kg: number | null;
          experience_level: ExperienceLevel | null;
          primary_goal: PrimaryGoal | null;
          training_days_per_week: number | null;
          equipment_access: string[] | null;
          goal_weight_kg: number | null;
          goal_date: string | null;
          weight_change_rate_kg_per_week: number | null;
          calorie_target_kcal: number | null;
          protein_target_g: number | null;
          carbs_target_g: number | null;
          fat_target_g: number | null;
          nutrition_tracking_enabled: boolean;
          onboarding_completed_at: string | null;
          created_at: string;
          deleted_at: string | null;
        };
        Insert: {
          id: string;
          email: string;
          display_name?: string | null;
          unit_system?: UnitSystem;
          unit_preference?: 'lbs' | 'kg';
          gender?: Gender | null;
          date_of_birth?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          experience_level?: ExperienceLevel | null;
          primary_goal?: PrimaryGoal | null;
          training_days_per_week?: number | null;
          equipment_access?: string[] | null;
          goal_weight_kg?: number | null;
          goal_date?: string | null;
          weight_change_rate_kg_per_week?: number | null;
          calorie_target_kcal?: number | null;
          protein_target_g?: number | null;
          carbs_target_g?: number | null;
          fat_target_g?: number | null;
          nutrition_tracking_enabled?: boolean;
          onboarding_completed_at?: string | null;
          deleted_at?: string | null;
        };
        Update: {
          email?: string;
          display_name?: string | null;
          unit_system?: UnitSystem;
          unit_preference?: 'lbs' | 'kg';
          gender?: Gender | null;
          date_of_birth?: string | null;
          height_cm?: number | null;
          weight_kg?: number | null;
          experience_level?: ExperienceLevel | null;
          primary_goal?: PrimaryGoal | null;
          training_days_per_week?: number | null;
          equipment_access?: string[] | null;
          goal_weight_kg?: number | null;
          goal_date?: string | null;
          weight_change_rate_kg_per_week?: number | null;
          calorie_target_kcal?: number | null;
          protein_target_g?: number | null;
          carbs_target_g?: number | null;
          fat_target_g?: number | null;
          nutrition_tracking_enabled?: boolean;
          onboarding_completed_at?: string | null;
          deleted_at?: string | null;
        };
        Relationships: [];
      };
      workout_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string | null;
          started_at: string;
          ended_at: string | null;
          notes: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          name?: string | null;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
        };
        Update: {
          user_id?: string;
          name?: string | null;
          started_at?: string;
          ended_at?: string | null;
          notes?: string | null;
        };
        Relationships: [];
      };
      rest_days: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          note?: string | null;
        };
        Update: {
          note?: string | null;
        };
        Relationships: [];
      };
      session_exercises: {
        Row: {
          id: string;
          session_id: string;
          exercise_id: string;
          order: number;
          notes: string | null;
        };
        Insert: {
          id?: string;
          session_id: string;
          exercise_id: string;
          order?: number;
          notes?: string | null;
        };
        Update: {
          session_id?: string;
          exercise_id?: string;
          order?: number;
          notes?: string | null;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          name: string;
          muscle_primary: string[];
          muscle_secondary: string[];
          equipment: string | null;
          is_custom: boolean;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          muscle_primary?: string[];
          muscle_secondary?: string[];
          equipment?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          muscle_primary?: string[];
          muscle_secondary?: string[];
          equipment?: string | null;
          is_custom?: boolean;
          created_by?: string | null;
        };
        Relationships: [];
      };
      sets: {
        Row: {
          id: string;
          session_exercise_id: string;
          set_number: number;
          reps: number;
          weight: number;
          unit: 'lbs' | 'kg';
          rpe: number | null;
          is_warmup: boolean;
          completed_at: string;
        };
        Insert: {
          id?: string;
          session_exercise_id: string;
          set_number: number;
          reps: number;
          weight: number;
          unit?: 'lbs' | 'kg';
          rpe?: number | null;
          is_warmup?: boolean;
          completed_at?: string;
        };
        Update: {
          session_exercise_id?: string;
          set_number?: number;
          reps?: number;
          weight?: number;
          unit?: 'lbs' | 'kg';
          rpe?: number | null;
          is_warmup?: boolean;
          completed_at?: string;
        };
        Relationships: [];
      };
      personal_records: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          rep_count: number;
          weight: number;
          unit: 'lbs' | 'kg';
          achieved_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          rep_count: number;
          weight: number;
          unit?: 'lbs' | 'kg';
          achieved_at?: string;
        };
        Update: {
          user_id?: string;
          exercise_id?: string;
          rep_count?: number;
          weight?: number;
          unit?: 'lbs' | 'kg';
          achieved_at?: string;
        };
        Relationships: [];
      };
      food_logs: {
        Row: {
          id: string;
          user_id: string;
          food_id: string;
          meal_type: MealType;
          serving_g: number;
          logged_at: string;
          date: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          food_id: string;
          meal_type?: MealType;
          serving_g: number;
          logged_at?: string;
          date: string;
        };
        Update: {
          user_id?: string;
          food_id?: string;
          meal_type?: MealType;
          serving_g?: number;
          logged_at?: string;
          date?: string;
        };
        Relationships: [];
      };
      foods: {
        Row: {
          id: string;
          name: string;
          brand: string | null;
          barcode: string | null;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          is_custom: boolean;
          created_by: string | null;
        };
        Insert: {
          id?: string;
          name: string;
          brand?: string | null;
          barcode?: string | null;
          calories_per_100g: number;
          protein_per_100g: number;
          carbs_per_100g: number;
          fat_per_100g: number;
          is_custom?: boolean;
          created_by?: string | null;
        };
        Update: {
          name?: string;
          brand?: string | null;
          barcode?: string | null;
          calories_per_100g?: number;
          protein_per_100g?: number;
          carbs_per_100g?: number;
          fat_per_100g?: number;
          is_custom?: boolean;
          created_by?: string | null;
        };
        Relationships: [];
      };
      user_daily_nutrition_summary: {
        Row: {
          user_id: string;
          date: string;
          total_calories_kcal: number;
          total_protein_g: number;
          total_carbs_g: number;
          total_fat_g: number;
          total_water_ml: number;
          meals_logged: number;
          computed_at: string;
        };
        Insert: {
          user_id: string;
          date: string;
          total_calories_kcal?: number;
          total_protein_g?: number;
          total_carbs_g?: number;
          total_fat_g?: number;
          total_water_ml?: number;
          meals_logged?: number;
          computed_at?: string;
        };
        Update: {
          total_calories_kcal?: number;
          total_protein_g?: number;
          total_carbs_g?: number;
          total_fat_g?: number;
          total_water_ml?: number;
          meals_logged?: number;
          computed_at?: string;
        };
        Relationships: [];
      };
      user_entitlements: {
        Row: {
          id: string;
          user_id: string;
          product_id: string;
          tier: EntitlementTier;
          expires_at: string | null;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          product_id: string;
          tier?: EntitlementTier;
          expires_at?: string | null;
          updated_at?: string;
        };
        Update: {
          user_id?: string;
          product_id?: string;
          tier?: EntitlementTier;
          expires_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
}
