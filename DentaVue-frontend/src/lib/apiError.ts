import type { FetchBaseQueryError } from '@reduxjs/toolkit/query'
import type { SerializedError } from '@reduxjs/toolkit'
import type { ApiErrorEnvelope } from '@/types/api'

/**
 * Turns whatever RTK Query threw into a sentence a user can act on.
 *
 * The error can be any of three shapes and each needs different handling:
 *   - the API's own error envelope (it responded, and said why)
 *   - a transport failure (it never responded — offline, CORS, API down)
 *   - a serialised JS error (something threw client-side)
 *
 * Without this every form ends up rendering "[object Object]".
 */
export function getApiErrorMessage(
  error: FetchBaseQueryError | SerializedError | undefined,
  fallback = 'Something went wrong. Please try again.',
): string | undefined {
  if (!error) return undefined

  if ('status' in error) {
    // FETCH_ERROR means the request never reached the API. Saying "invalid
    // credentials" here would be a lie — the server never saw them.
    if (error.status === 'FETCH_ERROR') {
      return "Can't reach the server. Check your connection and try again."
    }
    if (error.status === 'TIMEOUT_ERROR') {
      return 'The request timed out. Please try again.'
    }

    const body = error.data as Partial<ApiErrorEnvelope> | undefined
    if (body?.message) return body.message

    if (typeof error.status === 'number' && error.status >= 500) {
      return 'The server had a problem. Please try again shortly.'
    }
    return fallback
  }

  return error.message ?? fallback
}

/** Field-level errors from a 422, keyed by field name. */
export function getFieldErrors(
  error: FetchBaseQueryError | SerializedError | undefined,
): Record<string, string[]> | undefined {
  if (!error || !('status' in error)) return undefined
  return (error.data as Partial<ApiErrorEnvelope> | undefined)?.errors
}
