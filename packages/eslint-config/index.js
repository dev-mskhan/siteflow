import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';

/** @type {import('eslint').Linter.Config[]} */
export const base = [
  js.configs.recommended,
  ...tseslint.configs.recommended,
  prettier,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
  {
    ignores: ['dist/**', 'node_modules/**', '*.js', '*.mjs'],
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const server = [
  ...base,
  {
    rules: {
      'no-console': 'off', // Use pino logger instead — rule enforced by convention
    },
  },
];

/** @type {import('eslint').Linter.Config[]} */
export const react = [
  ...base,
  {
    rules: {
      'react/prop-types': 'off',
    },
  },
];
