// @ts-check
import eslint from '@eslint/js';
import eslintPluginPrettierRecommended from 'eslint-plugin-prettier/recommended';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      'eslint.config.mjs',
      'prisma/**/*.cjs',
      'scripts/**/*.cjs',
      'dist/**',
      'node_modules/**',
    ],
  },
  // Base JavaScript recommended rules
  eslint.configs.recommended,
  // TypeScript recommended rules
  ...tseslint.configs.recommendedTypeChecked,
  // Prettier integration
  eslintPluginPrettierRecommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
      sourceType: 'commonjs',
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    // Custom rules for NestJS backend
    rules: {
      // Allow 'any' in specific scenarios
      '@typescript-eslint/no-explicit-any': 'off',
      // Warn about floating promises (unhandled async)
      '@typescript-eslint/no-floating-promises': 'warn',
      // Warn about unsafe arguments
      '@typescript-eslint/no-unsafe-argument': 'warn',
      // Warn about unused variables (but allow underscore prefix)
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Prefer const where possible
      'prefer-const': 'warn',
      // No console in production (allow warn/error)
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      // Prettier formatting
      'prettier/prettier': ['error', { endOfLine: 'auto' }],
    },
  },
  {
    // Test files can have different rules
    name: 'test-files',
    files: ['test/**/*.ts', 'src/**/*.spec.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
);
