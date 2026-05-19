const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expo,
  {
    ignores: ['supabase/functions/**', '.expo/**'],
  },
  {
    settings: {
      react: { version: '18.3' },
    },
    rules: {
      'no-console': 'off',
    },
  },
]);
