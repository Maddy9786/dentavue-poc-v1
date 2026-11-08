'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useOauthCompleteMutation } from '@/features/auth/authApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { ROUTES } from '@/constants/routes'

/**
 * OAuth landing page.
 *
 * Google + Supabase redirect here after consent, with the session tokens in the
 * URL hash (implicit flow — see the backend's supabase.ts). This page relays
 * those tokens to the backend, which validates them and returns a real session,
 * then it forwards to the dashboard. The frontend never talks to Supabase — it
 * only carries the tokens the redirect handed it back to our own API.
 *
 * The tokens are read once and the hash is wiped immediately (replaceState), so
 * they don't linger in the address bar or browser history. Errors — a cancelled
 * consent, or the backend's ?error bounce — surface here with a way back.
 */

/** Reads a URL fragment like `#access_token=…&refresh_token=…` into a map. */
function parseHash(hash: string): Record<string, string> {
  return Object.fromEntries(new URLSearchParams(hash.replace(/^#/, '')))
}

export default function AuthCallbackPage() {
  const router = useRouter()
  const [oauthComplete, { error: completeError }] = useOauthCompleteMutation()
  // Only the parse-time failures (cancelled consent, missing tokens) need local
  // state; the backend call's failure is already tracked, and typed, by the
  // mutation hook. The two are merged for display below.
  const [hashError, setHashError] = useState<string | null>(null)

  // StrictMode mounts effects twice in dev; without this guard the tokens would
  // be consumed on the first run and gone (hash wiped) on the second, which
  // would look like a broken sign-in only in development.
  const started = useRef(false)

  useEffect(() => {
    if (started.current) return
    started.current = true

    // The work lives in an async function rather than the effect body: it reads
    // a browser-only API (the URL) and then awaits the network, and pulling it
    // out keeps state updates off the synchronous effect path.
    const run = async () => {
      const hashParams = parseHash(window.location.hash)
      // The backend bounces failures here as ?error; Supabase reports a
      // cancelled consent in the hash. Check both.
      const queryError = new URLSearchParams(window.location.search).get('error')

      // Strip tokens (and any error markers) from the URL before anything else,
      // so a refresh or a shared link cannot replay them.
      window.history.replaceState(null, '', window.location.pathname)

      const providerError = hashParams.error_description || hashParams.error || queryError
      if (providerError) {
        setHashError('Sign-in was cancelled or could not be completed. Please try again.')
        return
      }

      const accessToken = hashParams.access_token
      const refreshToken = hashParams.refresh_token
      if (!accessToken || !refreshToken) {
        setHashError('Sign-in could not be completed. Please try again.')
        return
      }

      try {
        await oauthComplete({ accessToken, refreshToken }).unwrap()
        router.replace(ROUTES.patient.dashboard)
      } catch {
        // Surfaced from `completeError` below — unwrap() rejects so the promise
        // does not go unhandled.
      }
    }

    void run()
  }, [oauthComplete, router])

  const error =
    hashError ?? getApiErrorMessage(completeError, 'Sign-in could not be completed. Please try again.') ?? null

  if (error) {
    return (
      <div className="flex flex-col items-center gap-lg text-center">
        <p role="alert" className="text-h1 text-error">
          {error}
        </p>
        <Link
          href={ROUTES.auth.signin}
          className="rounded-1 text-h1 font-medium text-foreground underline underline-offset-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          Back to sign in
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-lg text-center" role="status" aria-live="polite">
      <span
        aria-hidden="true"
        className="size-8 animate-spin rounded-full border-2 border-border border-t-primary"
      />
      <p className="text-h2 text-foreground-secondary">Signing you in…</p>
    </div>
  )
}
