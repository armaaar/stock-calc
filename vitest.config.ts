import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['src/**/__tests__/**/*.test.ts'],
    restoreMocks: true,
    // Tests expect the repository's src/data, whatever the developer's shell has set
    env: { STOCK_CALC_DATA_DIR: '' },
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/__tests__/**', 'src/**/__fixtures__/**', 'src/**/*.type.ts'],
      thresholds: {
        lines: 95,
        functions: 95,
        branches: 95,
        statements: 95,
      },
    },
  },
})
