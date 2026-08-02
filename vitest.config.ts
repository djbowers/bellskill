import { defineConfig, mergeConfig } from 'vitest/config';

import viteConfig from './vite.config';

// https://vitest.dev/config/
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      globals: true,
      environment: 'jsdom',
      // Vite loads a developer's `.env.local` in every mode, and it outranks
      // `.env.test` — so an unrelated local flag could silently change what the
      // suite renders. Pin every build-time flag here (matching `.env.test`) so
      // runs are identical on every machine and in CI.
      env: {
        VITE_FEATURE_BOTTOMNAV: 'false',
        VITE_FEATURE_COMPLEX_MODE: 'true',
        VITE_FEATURE_EXPLORE: 'true',
        VITE_FEATURE_PREMIUM: 'false',
        VITE_FEATURE_PROGRAMS: 'true',
        VITE_FEATURE_WEEKLY_BALANCE: 'true',
      },
      setupFiles: './config/vitest.setup.ts',
      exclude: ['**/node_modules/**', 'e2e/**', '**/.claude/**'],
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
