import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['**/dist/**', 'functions/lib/**', '**/node_modules/**', 'playwright-report/**', 'test-results/**', 'coverage/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['scripts/**/*.mjs', 'api/**/*.js'],
    languageOptions: { globals: { process: 'readonly', console: 'readonly' } },
  },
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true }],
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },
);
