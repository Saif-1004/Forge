import { schemaMigrations, createTable, addColumns } from '@nozbe/watermelondb/Schema/migrations';


export const migrations = schemaMigrations({
  migrations: [
    {
      toVersion: 2,
      steps: [
        createTable({
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
      ],
    },
    {
      toVersion: 3,
      steps: [
        addColumns({
          table: 'sets',
          columns: [
            { name: 'duration_seconds', type: 'number', isOptional: true },
          ],
        }),
      ],
    },
    {
      toVersion: 4,
      steps: [
        createTable({
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
        createTable({
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
      ],
    },
    {
      toVersion: 5,
      steps: [
        createTable({
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
      ],
    },
  ],
});
