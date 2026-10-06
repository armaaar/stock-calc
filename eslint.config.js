import js from '@eslint/js'
import stylistic from '@stylistic/eslint-plugin'
import importX from 'eslint-plugin-import-x'
import { defineConfig, globalIgnores } from 'eslint/config'
import tseslint from 'typescript-eslint'

export default defineConfig(
  globalIgnores(['node_modules', 'coverage']),
  js.configs.recommended,
  tseslint.configs.recommended,
  stylistic.configs.customize({
    indent: 2,
    quotes: 'single',
    semi: false,
    commaDangle: 'always-multiline',
    braceStyle: '1tbs',
    arrowParens: true,
  }),
  {
    plugins: { 'import-x': importX },
    rules: {
      // Carried over from the airbnb style the project used before ESLint 10
      '@stylistic/max-len': ['error', {
        code: 100,
        ignoreUrls: true,
        ignoreStrings: true,
        ignoreTemplateLiterals: true,
        ignoreRegExpLiterals: true,
      }],
      '@stylistic/lines-between-class-members': ['error', 'always', { exceptAfterSingleLine: false }],
      'import-x/first': 'error',
      'import-x/no-duplicates': 'error',
      'import-x/newline-after-import': 'error',
      'no-console': 'warn',
      'max-classes-per-file': ['warn', { ignoreExpressions: true, max: 3 }],
    },
  },
  {
    files: ['**/*.test.ts'],
    rules: {
      'no-console': 'off',
      'max-classes-per-file': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
)
