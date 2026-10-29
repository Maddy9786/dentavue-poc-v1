import rateLimit, { ipKeyGenerator, type Options } from 'express-rate-limit'
import type { NextFunction, Request, Response } from 'express'
import { ApiError } from '@/utils/ApiError.js'
import { env } from '@/config/env.js'

/**
 * Rate limits for the auth routes.
 *
 * These exist because /signin was previously unthrottled: Supabase caps OTP
 * sends and returns 429, but nothing capped password attempts, so an attacker
 * could guess as fast as the network allowed. Supabase's own limits protect
 * Supabase's costs, not this API's accounts.
 *
 * IN-MEMORY STORE — read this before deploying more than one instance.
 * Counters live in the process, so N instances behind a load balancer means
 * roughly N times the stated limit, and a deploy resets every counter. That is
 * still enormously better than no limit (it turns thousands of guesses per
 * minute into a handful), but it is not the finished article. env.REDIS_URL is
 * reserved for this: add `rate-limit-redis` and pass `store` below, and the
 * limits become global and survive restarts. Do that before launch.
 *
 * Requires `app.set('trust proxy', ...)` to be correct, which app.ts does —
 * otherwise every request behind a proxy shares one IP and the first user to
 * mistype a password locks out everybody.
 */

/** Shared across every limiter here; individual limiters override window/max. */
const base: Partial<Options> = {
  // Modern `RateLimit-*` headers; the legacy `X-RateLimit-*` set is off.
  standardHeaders: 'draft-7',
  legacyHeaders: false,

  /**
   * Routed through ApiError so a 429 carries the same envelope as every other
   * error and the web app's getApiErrorMessage renders it like anything else.
   * next(), not throw: this handler is called from async internals.
   */
  handler: (_req: Request, _res: Response, next: NextFunction, options: Options) => {
    next(new ApiError(429, options.message as string))
  },

  /**
   * Opt-out only, and off by default (env gates it out of production entirely).
   * A suite that drives sign-in many times as setup can set DISABLE_RATE_LIMIT
   * to avoid tripping on its own traffic — but limits stay ON in tests unless
   * asked, so the control is exercised by default rather than silently skipped.
   */
  skip: () => env.DISABLE_RATE_LIMIT,
}

/**
 * Password guessing, keyed by IP.
 *
 * Deliberately counts successful sign-ins too (`skipSuccessfulRequests` is
 * left off). Skipping them sounds generous, but it hands an attacker a free
 * reset every time they land a hit — which is precisely the moment to slow
 * down, not speed up.
 */
export const signinLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many sign-in attempts. Please try again in a few minutes.',
})

/**
 * The same guessing, keyed by the account instead.
 *
 * Applied alongside signinLimiter, because IP alone is the wrong unit in both
 * directions: an attacker rotating through a proxy pool gets a fresh budget per
 * IP, while a hospital behind one NAT shares a single budget between hundreds
 * of honest staff. Per-account is the limit that actually tracks the thing
 * being attacked, and it does not care where the requests come from.
 *
 * The window is longer and the count lower than per-IP: an account seeing 5
 * failures in an hour is far more suspicious than an office seeing 10.
 */
export const signinAccountLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many sign-in attempts for this account. Please try again later.',

  keyGenerator: (req: Request) => {
    const email = (req.body as { email?: unknown } | undefined)?.email
    // Falls back to the IP when there is no usable email — a malformed body
    // must not key every such request to one shared bucket, which would let one
    // caller exhaust the limit for everyone.
    if (typeof email !== 'string' || email.length === 0) return ipKeyGenerator(req.ip ?? '')
    return `account:${email.trim().toLowerCase()}`
  },

  // Only failures count here. Unlike the per-IP limiter, this key is chosen by
  // the caller: counting successes would let anyone lock a known email address
  // out of their own account by burning the budget from anywhere.
  skipSuccessfulRequests: true,
})

/**
 * Account creation. Slow rather than strict — real people sign up once, and a
 * shared IP might legitimately produce a few in an hour.
 */
export const signupLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 5,
  message: 'Too many accounts created from here. Please try again later.',
})

/**
 * OTP requests.
 *
 * Every one of these is an SMS with a price on it once a provider is attached,
 * so this is a bill as much as a security control. Supabase throttles too, but
 * that throttle is not reachable while the flow is mocked in the browser — this
 * is the only limit on the path today.
 */
export const otpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 5,
  message: 'Too many codes requested. Please wait a few minutes before trying again.',
})

/**
 * Code guessing. A 6-digit code is one in a million per attempt, which is only
 * strong if the attempts are capped — unlimited tries against a 5-minute code
 * is a very different proposition.
 */
export const verifyOtpLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  message: 'Too many incorrect codes. Please request a new one.',
})

/**
 * OAuth start + completion.
 *
 * Keyed by IP and generous: a user bouncing through Google may legitimately hit
 * start a few times (cancel, retry, back button), and completion is one call per
 * successful round trip. This is a spam backstop on URL generation and token
 * relay, not a guessing control — the token posted to completion is validated
 * against Supabase regardless, so brute force gains nothing.
 */
export const oauthLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 20,
  message: 'Too many sign-in attempts. Please try again in a few minutes.',
})

/**
 * Refresh runs on a timer for every signed-in user, so this is a runaway-client
 * backstop, not a security control — set well above any legitimate rhythm.
 */
export const refreshLimiter = rateLimit({
  ...base,
  windowMs: 15 * 60 * 1000,
  limit: 60,
  message: 'Too many refresh attempts. Please try again shortly.',
})

/**
 * Scan uploads, keyed per account.
 *
 * Each upload writes an image to Storage, so an unbounded loop could fill the
 * bucket (a cost and a mess). A real person scans a handful of times an hour at
 * most, so this is generous headroom over normal use, not a tight control —
 * mounted AFTER authenticate, so it keys on the user, not a shared NAT IP.
 *
 * Falls back to the IP when — for whatever reason — there is no user on the
 * request, so a bucket is always chosen.
 */
export const scanUploadLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 30,
  message: 'Too many scans uploaded. Please try again later.',
  keyGenerator: (req: Request) => {
    const userId = req.user?.userId
    return userId ? `scan:${userId}` : ipKeyGenerator(req.ip ?? '')
  },
})

/**
 * Manual re-analysis, keyed per account.
 *
 * This one is a BILL as much as a control: every call is two Gemini requests
 * against four images. Uploads are already capped at 30/hour and each triggers
 * one analysis automatically, so this limits only the retry affordance — a
 * person clicking "try again" a few times, not a loop. Tighter than the upload
 * limit precisely because nothing else stands between it and the spend.
 */
export const analysisLimiter = rateLimit({
  ...base,
  windowMs: 60 * 60 * 1000,
  limit: 10,
  message: 'Too many analysis requests. Please try again later.',
  keyGenerator: (req: Request) => {
    const userId = req.user?.userId
    return userId ? `analysis:${userId}` : ipKeyGenerator(req.ip ?? '')
  },
})
