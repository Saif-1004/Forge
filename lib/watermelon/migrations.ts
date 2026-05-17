import { schemaMigrations, createTable } from '@nozbe/watermelondb/Schema/migrations';

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
  ],
});
