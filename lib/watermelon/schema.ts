import { appSchema, tableSchema } from '@nozbe/watermelondb';

export const schema = appSchema({
  version: 5,
  tables: [
    tableSchema({
      name: 'exercises',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'muscle_primary', type: 'string' },   // JSON array string
        { name: 'muscle_secondary', type: 'string' }, // JSON array string
        { name: 'equipment', type: 'string', isOptional: true },
        { name: 'is_custom', type: 'boolean' },
        { name: 'created_by', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'workout_sessions',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'name', type: 'string', isOptional: true },
        { name: 'started_at', type: 'number' },  // unix ms
        { name: 'ended_at', type: 'number', isOptional: true },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'session_exercises',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'session_id', type: 'string' },    // local WatermelonDB id
        { name: 'exercise_id', type: 'string' },   // local WatermelonDB id
        { name: 'exercise_remote_id', type: 'string', isOptional: true },
        { name: 'order_index', type: 'number' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'sets',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'session_exercise_id', type: 'string' }, // local WatermelonDB id
        { name: 'set_number', type: 'number' },
        { name: 'reps', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'unit', type: 'string' },   // 'lbs' | 'kg'
        { name: 'rpe', type: 'number', isOptional: true },
        { name: 'is_warmup', type: 'boolean' },
        { name: 'completed_at', type: 'number' }, // unix ms
        { name: 'duration_seconds', type: 'number', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'personal_records',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'exercise_id', type: 'string' },
        { name: 'exercise_remote_id', type: 'string', isOptional: true },
        { name: 'rep_count', type: 'number' },
        { name: 'weight', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'achieved_at', type: 'number' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'food_logs',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'food_id', type: 'string', isOptional: true },      // local id
        { name: 'food_remote_id', type: 'string', isOptional: true },
        { name: 'food_name', type: 'string' },
        { name: 'meal_type', type: 'string' }, // 'breakfast' | 'lunch' | 'dinner' | 'snack'
        { name: 'serving_g', type: 'number' },
        { name: 'calories_kcal', type: 'number' },
        { name: 'protein_g', type: 'number' },
        { name: 'carbs_g', type: 'number' },
        { name: 'fat_g', type: 'number' },
        { name: 'logged_at', type: 'number' }, // unix ms
        { name: 'date', type: 'string' },       // ISO date 'YYYY-MM-DD'
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'water_logs',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'amount_ml', type: 'number' },
        { name: 'logged_at', type: 'number' }, // unix ms
        { name: 'date', type: 'string' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'workout_templates',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'name', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'created_at', type: 'number' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'template_exercises',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'template_id', type: 'string' },
        { name: 'exercise_id', type: 'string' },
        { name: 'order_index', type: 'number' },
        { name: 'default_sets', type: 'number' },
        { name: 'default_reps', type: 'number' },
        { name: 'default_weight', type: 'number' },
        { name: 'default_unit', type: 'string' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'body_weight_logs',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'user_id', type: 'string' },
        { name: 'weight', type: 'number' },
        { name: 'unit', type: 'string' },
        { name: 'logged_at', type: 'number' },
        { name: 'date', type: 'string' },
        { name: 'notes', type: 'string', isOptional: true },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),

    tableSchema({
      name: 'foods',
      columns: [
        { name: 'remote_id', type: 'string', isOptional: true },
        { name: 'name', type: 'string' },
        { name: 'brand', type: 'string', isOptional: true },
        { name: 'barcode', type: 'string', isOptional: true },
        { name: 'calories_per_100g', type: 'number' },
        { name: 'protein_per_100g', type: 'number' },
        { name: 'carbs_per_100g', type: 'number' },
        { name: 'fat_per_100g', type: 'number' },
        { name: 'is_custom', type: 'boolean' },
        { name: 'created_by', type: 'string', isOptional: true },
        { name: 'synced_at', type: 'number', isOptional: true },
      ],
    }),
  ],
});
