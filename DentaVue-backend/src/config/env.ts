// Loads .env into process.env BEFORE the schema below reads it. This is the
// first module in the app that touches process.env, and everything funnels
// through it, so loading here covers every entry point (dev via tsx, prod via
// node, tests) without each needing a --env-file flag. It must be the first
// import: the validation below runs at module load, so a later import would be
// too late. dotenv is a no-op when .env is absent (real deploys inject vars
// directly) and never overrides a var already set, so test setup still wins.
import 'dotenv/config'
import { z } from 'zod'

/**
 * Validates process.env at boot. An invalid or missing var fails the process
 * immediately rather than surfacing as an undefined deep inside a request.
 */

/**
 * Treats a blank var as absent.
 *
 * `.env.example` deliberately ships keys with nothing after the `=` (that is how
 * you document a variable you cannot supply a value for). dotenv loads those as
 * EMPTY STRINGS, not undefined — so `.optional()` alone does not accept them,
 * `.default()` does not fire, and `z.coerce.number()` turns '' into 0. Without
 * this wrapper, copying .env.example to .env and filling in only the Supabase
 * keys crashes the process at boot with a confusing message about the key you
 * intentionally left blank.
 *
 * Whitespace counts as blank too: `KEY= ` is a typo, not a value.
 */
function blankAsAbsent<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema,
  )
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  API_PREFIX: z.string().default('/v1'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:3000')
    .transform((value) => value.split(',').map((origin) => origin.trim())),

  // Where OAuth lands the user back after Google/Supabase. Must EXACTLY match a
  // URL in Supabase's Auth > URL Configuration > Redirect URLs allowlist, or
  // Supabase refuses the redirect. This is the frontend origin, not this API —
  // the browser finishes the flow on a page the web app serves.
  WEB_APP_URL: z.string().url().default('http://localhost:3000'),

  // SameSite policy for the refresh cookie (session persistence). Leave 'lax'
  // when the web app and API share a registrable domain — localhost in dev, or a
  // custom-domain prod like app.dentavue.io + api.dentavue.io. It MUST be 'none' when
  // they sit on different sites, e.g. two Render services on *.onrender.com (the
  // Public Suffix List treats each *.onrender.com as its own site), or the
  // browser will not send the cookie and the session will not survive a reload.
  // 'none' requires Secure, which is on in production (secure: isProduction).
  COOKIE_SAMESITE: z.enum(['lax', 'none', 'strict']).default('lax'),

  // --- Supabase ---------------------------------------------------------
  // Auth lives in Supabase: it owns users, sessions, OTP delivery and OAuth,
  // and issues the tokens this API hands back. There are therefore no JWT
  // secrets here — we verify Supabase's tokens rather than mint our own.
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  SUPABASE_ANON_KEY: z.string().min(1),

  // Direct Postgres connection, for migrations only — nothing on the request
  // path reads it (the app talks to Supabase through its JS client, which needs
  // the URL and keys above, not a Postgres DSN). Optional so the API boots for
  // normal use without it; the migration tooling, once it exists, should assert
  // it is present itself rather than blocking every boot on it.
  DATABASE_URL: blankAsAbsent(z.string().url().optional()),

  // Optional until something needs it (slot reservations, rate limiting).
  // Supabase handles OTP storage and expiry, so Redis is not on the auth path.
  REDIS_URL: blankAsAbsent(z.string().url().optional()),

  // --- Gemini (scan analysis) -------------------------------------------
  // The AI layer. Absent = analysis is skipped entirely: uploads still work,
  // scans still render, every result screen just has no analysis attached. That
  // is deliberate — a missing integration key must not stop the product booting.
  //
  // SERVER-ONLY, like the Supabase service-role key. It must never reach a
  // browser: the web app talks only to this API, and this API talks to Google.
  GEMINI_API_KEY: blankAsAbsent(z.string().min(1).optional()),

  // The vision pass. Flash is the recommendation (AI_INTEGRATION.md): it is the
  // only mainstream tier with native bounding boxes, which the annotated-scan
  // carousel needs.
  //
  // NOT 2.5: Google has closed `gemini-2.5-flash` to new API keys — it still
  // appears in ListModels but answers 404 "no longer available to new users".
  // Verified against a live key on 2026-07-23; 3.x Flash is the current tier.
  //
  // Defaults to flash-lite to match .env.example: 5x cheaper and 5x faster, and
  // it still returns bounding boxes. `gemini-3.6-flash` is the quality option —
  // its annotations spread across the correct frames rather than clustering.
  // The two calibrate differently (a whole band apart on the same photo), so
  // scan_analysis.model records which one produced each result.
  GEMINI_MODEL: blankAsAbsent(z.string().min(1).default('gemini-3.5-flash-lite')),

  // The narrative pass is text-only and much cheaper, so it can run on a
  // smaller tier. Set it equal to GEMINI_MODEL if the prose is not good enough.
  GEMINI_NARRATIVE_MODEL: blankAsAbsent(z.string().min(1).default('gemini-3.5-flash-lite')),

  // Tried in order when the primary is unavailable. Google's flash tiers
  // routinely return 503 under load (and sometimes a bare 404, which means the
  // same thing), and an analysis should not fail because one tier was busy.
  //
  // Availability, not quality: the model that answered is stored per analysis,
  // because severities are not perfectly comparable across models. Bands absorb
  // much of that difference, but a cross-model comparison should be detectable.
  GEMINI_FALLBACK_MODELS: blankAsAbsent(
    z
      .string()
      .default('gemini-3.6-flash,gemini-flash-lite-latest')
      .transform((value) => value.split(',').map((model) => model.trim()).filter(Boolean)),
  ),

  // How finely Gemini tokenises each scan image. THE biggest cost lever here,
  // with a costly default: unset means HIGH, which on a 390x280 photo bills
  // 1092 tokens; MEDIUM is 540 and LOW is 266 (measured, gemini-3.6-flash).
  // Four frames at HIGH is ~4,400 input tokens per scan; at MEDIUM, ~2,160.
  //
  // MEDIUM is the default here: it halves the bill with no observed change to
  // the banded result on real intraoral photos. Raise to HIGH if fine enamel
  // detail turns out to matter; drop to LOW to halve it again.
  GEMINI_MEDIA_RESOLUTION: blankAsAbsent(
    z.enum(['LOW', 'MEDIUM', 'HIGH']).default('MEDIUM'),
  ),

  // Hard ceiling per model call. Without one, a hung socket pins an analysis in
  // `pending` forever and the analysing screen spins indefinitely.
  GEMINI_TIMEOUT_MS: blankAsAbsent(z.coerce.number().int().positive().default(60_000)),

  // Kill switch, independent of the key. Lets analysis be turned off on a live
  // box (cost spike, provider incident, a bad prompt shipped) without pulling
  // the credential and without a redeploy.
  AI_ANALYSIS_ENABLED: blankAsAbsent(
    z
      .enum(['true', 'false'])
      .default('true')
      .transform((value) => value === 'true'),
  ),

  // Escape hatch for the auth rate limiters, off by default so limits are ON
  // everywhere unless explicitly disabled — a security control should fail
  // closed. Set true only for a test or load run that would otherwise trip its
  // own limits. NEVER set in production. Gated to non-production below so it
  // cannot silently disable protection on a live box.
  DISABLE_RATE_LIMIT: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:')
  console.error(z.prettifyError(parsed.error))
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'

// Refuse to boot a production process with rate limiting disabled: the flag is a
// test convenience, and a stray `DISABLE_RATE_LIMIT=true` in a prod env would
// otherwise turn off account protection with no other signal.
if (isProduction && env.DISABLE_RATE_LIMIT) {
  console.error('DISABLE_RATE_LIMIT must not be set in production.')
  process.exit(1)
}

// A visible, one-line boot signal rather than a silent no-op. Without it, the
// commonest failure — analysis quietly doing nothing because the key was never
// set — looks identical to a model that returns nothing.
if (env.AI_ANALYSIS_ENABLED && !env.GEMINI_API_KEY) {
  console.warn('GEMINI_API_KEY is not set — scan analysis will be skipped.')
}

// SameSite=None cookies are rejected by browsers unless they are also Secure,
// which is only on in production. Flag the mismatch loudly rather than letting
// session-restore fail silently in a misconfigured non-prod box.
if (env.COOKIE_SAMESITE === 'none' && !isProduction) {
  console.warn(
    'COOKIE_SAMESITE=none needs Secure cookies (production only) — the refresh cookie will be dropped over http.',
  )
}
