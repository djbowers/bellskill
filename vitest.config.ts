import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// https://vitest.dev/config/
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './config/vitest.setup.ts',
      exclude: ['**/node_modules/**', 'e2e/**'],
      // Reduce test output verbosity
      reporters: ['basic'],
      logHeapUsage: false,
      // Silence console logs during tests
      silent: false,
      // Only show errors in console
      onConsoleLog: () => false,
    },
  }),
);
