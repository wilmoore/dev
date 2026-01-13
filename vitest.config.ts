import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Run TypeScript directly (matches project's tsx approach)
    include: ['test/**/*.test.ts'],
    exclude: ['**/node_modules/**', '**/dist/**'],

    // Node environment for CLI testing
    environment: 'node',

    // Global test APIs (describe, it, expect)
    globals: true,

    // Isolation prevents test pollution
    isolate: true,

    // Fork pool for better process isolation
    pool: 'forks',

    // Timeouts for E2E tests involving processes
    testTimeout: 30000,
    hookTimeout: 10000,

    // Clear mocks between tests
    clearMocks: true,
    restoreMocks: true,

    // Setup file for global configuration
    setupFiles: ['./test/setup.ts'],

    // Coverage configuration
    coverage: {
      provider: 'v8',
      enabled: false, // Enable with --coverage flag
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['bin/**/*.ts'],
      exclude: ['**/*.test.ts', 'test/**'],
    },

    // Reporter configuration
    reporters: ['default'],

    // Sequence configuration
    sequence: {
      shuffle: false, // Keep tests predictable
    },

    // Run E2E tests sequentially to avoid config file conflicts
    fileParallelism: false,
  },
});
