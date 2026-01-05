import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
  // Ignore patterns (replaces .eslintignore)
  {
    ignores: [
      'dist/**',
      'build/**',
      'node_modules/**',
      'coverage/**',
      '*.config.js',
      '*.config.ts',
      '.vscode/**',
      '.husky/**',
      'lambda/**/node_modules/**',
      'lambda-layers/**',
      'scripts/**/*.mjs',
      '**/*.d.ts',
    ],
  },

  // Base config for all files
  {
    files: ['**/*.{js,jsx,ts,tsx}'],
    languageOptions: {
      ecmaVersion: 2020,
      sourceType: 'module',
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.es2020,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      ...js.configs.recommended.rules,
      ...tsPlugin.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...reactHooksPlugin.configs.recommended.rules,

      // Custom rules
      'no-console': 'off', // Allow console in logger.ts
      '@typescript-eslint/no-unused-vars': 'warn', // Downgrade to warning
      '@typescript-eslint/no-explicit-any': 'off', // Too many false positives
      'no-undef': 'off', // TypeScript handles this
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react/no-unescaped-entities': 'off',
      'react-hooks/exhaustive-deps': 'off', // Too strict for current codebase
      'react-hooks/immutability': 'off'
    },
    settings: {
      react: {
        version: 'detect',
      },
    },
  },

  // Apply prettier config last to disable conflicting rules
  prettierConfig,
];
