import { AuthRetryableFetchError, type AuthError } from '@supabase/supabase-js'
import { ApiError } from './ApiError.js'
import { logger } from '@/config/logger.js'

/**
 * Maps a Supabase auth error onto the right HTTP status.
 *
 * Without this, every Supabase failure collapses into one status and one
 * message, which is wrong in both directions:
 *
 *   - A Supabase outage came back as `400 "fetch failed"`. That tells the client
 *     its request was malformed, so it will not retry — when retrying is exactly
 *     the correct response to an upstream being down. It also leaks an internal
 *     message that means nothing to a user.
 *   - A genuine 429 (SMS rate limit) needs to stay a 429, or the UI cannot tell
 *     the user to wait.
 *
 * The rule: faults on OUR side of the boundary are 5xx and never echo the
 * upstream's words; faults in the CALLER's request are 4xx and may.
 */
export function mapSupabaseAuthError(
  error: AuthError,
  fallbackMessage: string,
  context: string,
): ApiError {
  // Never reached Supabase — DNS, TLS, timeout, upstream down. Not the caller's
  // fault, and retryable.
  if (error instanceof AuthRetryableFetchError || /fetch failed/i.test(error.message)) {
    logger.error({ err: error, context }, 'Supabase unreachable')
    return new ApiError(503, 'Authentication is temporarily unavailable. Please try again.')
  }

  const status = error.status ?? 500

  // Supabase's own rate limiting (SMS sends, sign-in attempts).
  if (status === 429) {
    return new ApiError(429, 'Too many attempts. Please wait before trying again.')
  }

  // Supabase says the caller got it wrong: safe to pass its message through.
  if (status >= 400 && status < 500) {
    return new ApiError(status, error.message)
  }

  // Supabase itself failed. Log the detail, tell the caller nothing.
  logger.error({ err: error, status, context }, 'Supabase auth error')
  return new ApiError(502, fallbackMessage)
}
