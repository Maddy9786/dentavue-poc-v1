import { describe, expect, it } from 'vitest'
import { z } from 'zod'

/**
 * Guards the one class of env bug that is invisible until it isn't: a variable
 * that is PRESENT BUT BLANK.
 *
 * `.env.example` documents optional integrations by shipping the key with
 * nothing after the `=` — `GEMINI_API_KEY=`. dotenv loads that as an EMPTY
 * STRING, not undefined. That distinction breaks three things at once:
 *
 *   .optional()          rejects '' (it only permits undefined)
 *   .default('x')        does not fire for '' (a value was supplied)
 *   z.coerce.number()    turns '' into 0, which then fails .positive()
 *
 * So copying .env.example to .env, filling in only the Supabase keys, and
 * starting the API crashed at boot complaining about a key the user had
 * deliberately left blank. src/config/env.ts wraps every such var in
 * blankAsAbsent() to fix it.
 *
 * These tests exercise that wrapper's SHAPE rather than importing env.ts, which
 * reads the real process.env and calls process.exit(1) on failure — untestable
 * by design, and rightly so.
 */

/** Mirrors blankAsAbsent() in src/config/env.ts. Keep the two in step. */
function blankAsAbsent<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? undefined : value),
    schema,
  )
}

describe('blankAsAbsent', () => {
  describe('optional strings (GEMINI_API_KEY)', () => {
    const schema = blankAsAbsent(z.string().min(1).optional())

    it('accepts a blank var — the .env.example case that used to crash the boot', () => {
      expect(schema.parse('')).toBeUndefined()
    })

    it('accepts whitespace-only as blank — "KEY= " is a typo, not a value', () => {
      expect(schema.parse('   ')).toBeUndefined()
    })

    it('accepts a genuinely absent var', () => {
      expect(schema.parse(undefined)).toBeUndefined()
    })

    it('passes a real value through untouched', () => {
      expect(schema.parse('AIzaSyReal-Key')).toBe('AIzaSyReal-Key')
    })

    it('does not trim a real value — an API key is opaque', () => {
      expect(schema.parse(' key-with-spaces ')).toBe(' key-with-spaces ')
    })
  })

  describe('defaulted strings (GEMINI_MODEL)', () => {
    const schema = blankAsAbsent(z.string().min(1).default('gemini-2.5-flash'))

    it('falls back to the default when blank, instead of yielding an empty model name', () => {
      expect(schema.parse('')).toBe('gemini-2.5-flash')
    })

    it('falls back when absent', () => {
      expect(schema.parse(undefined)).toBe('gemini-2.5-flash')
    })

    it('respects an override', () => {
      expect(schema.parse('gemini-3-pro')).toBe('gemini-3-pro')
    })
  })

  describe('coerced numbers (GEMINI_TIMEOUT_MS)', () => {
    const schema = blankAsAbsent(z.coerce.number().int().positive().default(60_000))

    it('uses the default when blank — bare coerce would make it 0 and fail positive()', () => {
      expect(schema.parse('')).toBe(60_000)
    })

    it('still coerces a real value', () => {
      expect(schema.parse('30000')).toBe(30_000)
    })

    it('still rejects a genuinely invalid value', () => {
      expect(() => schema.parse('-5')).toThrow()
      expect(() => schema.parse('abc')).toThrow()
    })
  })

  describe('booleans (AI_ANALYSIS_ENABLED)', () => {
    const schema = blankAsAbsent(
      z
        .enum(['true', 'false'])
        .default('true')
        .transform((value) => value === 'true'),
    )

    it('defaults to on when blank', () => {
      expect(schema.parse('')).toBe(true)
    })

    it('honours an explicit false — the kill switch must work', () => {
      expect(schema.parse('false')).toBe(false)
    })

    it('rejects a typo rather than silently treating it as false', () => {
      // 'False' or 'no' meaning "on" would be a security-relevant surprise for
      // a flag whose whole job is turning something off.
      expect(() => schema.parse('False')).toThrow()
      expect(() => schema.parse('no')).toThrow()
    })
  })

  describe('urls (DATABASE_URL, REDIS_URL)', () => {
    const schema = blankAsAbsent(z.string().url().optional())

    it('accepts a blank var — bare .url() rejects an empty string', () => {
      expect(schema.parse('')).toBeUndefined()
    })

    it('still rejects a malformed url', () => {
      expect(() => schema.parse('not-a-url')).toThrow()
    })
  })
})

describe('.env.example is bootable', () => {
  /**
   * The regression this whole file exists for: parse the Gemini block exactly as
   * a fresh `cp .env.example .env` would present it, with only the Supabase keys
   * filled in. This must not throw.
   */
  it('parses the shipped blanks without throwing', () => {
    const schema = z.object({
      GEMINI_API_KEY: blankAsAbsent(z.string().min(1).optional()),
      GEMINI_MODEL: blankAsAbsent(z.string().min(1).default('gemini-2.5-flash')),
      GEMINI_NARRATIVE_MODEL: blankAsAbsent(z.string().min(1).default('gemini-2.5-flash-lite')),
      GEMINI_TIMEOUT_MS: blankAsAbsent(z.coerce.number().int().positive().default(60_000)),
      AI_ANALYSIS_ENABLED: blankAsAbsent(
        z
          .enum(['true', 'false'])
          .default('true')
          .transform((value) => value === 'true'),
      ),
    })

    const result = schema.parse({
      GEMINI_API_KEY: '', // shipped blank — the user has not got a key yet
      GEMINI_MODEL: 'gemini-2.5-flash',
      GEMINI_NARRATIVE_MODEL: 'gemini-2.5-flash-lite',
      GEMINI_TIMEOUT_MS: '60000',
      AI_ANALYSIS_ENABLED: 'true',
    })

    // Analysis is enabled but unconfigured: the app boots, warns, and skips
    // analysis rather than refusing to start.
    expect(result.GEMINI_API_KEY).toBeUndefined()
    expect(result.AI_ANALYSIS_ENABLED).toBe(true)
    expect(result.GEMINI_MODEL).toBe('gemini-2.5-flash')
  })
})
