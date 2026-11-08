/**
 * Runs before any test module is imported (see vitest.config.ts).
 *
 * config/env.ts validates process.env at import time and exits the process on a
 * missing Supabase var. These are throwaway values good enough to pass that
 * schema — no test here reaches a real Supabase, so their content is irrelevant
 * beyond being present and well-formed (URL, non-empty key).
 *
 * DISABLE_RATE_LIMIT is deliberately left unset: the limiters must be live so
 * the rate-limit test exercises the real thing. A future suite that trips its
 * own limits can set it, per-file, before importing.
 */
process.env.NODE_ENV = 'test'
process.env.SUPABASE_URL ??= 'https://test-project.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY ??= 'test-service-role-key'
process.env.SUPABASE_ANON_KEY ??= 'test-anon-key'
process.env.DATABASE_URL ??= 'postgresql://postgres:test@localhost:5432/postgres'
