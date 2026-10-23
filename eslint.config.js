import js from '@eslint/js';
import { defineConfig } from 'eslint/config';

export default defineConfig({ ignores: ['node_modules'] }, js.configs.recommended, {
  files: ['**/*.{js,mjs}'],
  languageOptions: {
    ecmaVersion: 2024,
    sourceType: 'module',
    // The scripts import `process` from node:process; console is the only global they use.
    globals: { console: 'readonly' },
  },
  rules: {
    'eol-last': 'error',
  },
});
