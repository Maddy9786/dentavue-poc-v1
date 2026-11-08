import { defineConfig } from 'vitest/config'

/**
 * Vitest for the backend.
 *
 * resolve.tsconfigPaths teaches Vite the `@/*` alias from tsconfig (native in
 * Vite 6 / Vitest 4, so no plugin) so tests import the same way the source does.
 * The source uses NodeNext `.js` suffixes on relative imports
 * (`@/config/env.js`); this resolves them onto the real `.ts` files, so no test
 * has to spell paths differently from the code under test.
 *
 * setupFiles runs before any module loads. It has to: config/env.ts validates
 * process.env at import and calls process.exit(1) if a Supabase var is missing,
 * so without dummy values in place first, merely importing anything that pulls
 * in env would kill the test run.
 */
export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['tests/**/*.test.ts'],
  },
})
