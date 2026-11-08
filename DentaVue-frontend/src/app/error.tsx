'use client'

import { useEffect } from 'react'
import { StatusScreen } from '@/components/feedback/StatusScreen'
import { RecoveryActions } from '@/components/feedback/RecoveryActions'
import { AlertTriangleGlyph, WifiOffGlyph } from '@/components/ui/StatusGlyphs'

/**
 * Route error boundary — Next.js renders this when a segment throws while
 * rendering. MUST be a client component and receives `reset`, which re-renders
 * the failed segment so "Try again" returns the user to the screen they were on.
 *
 * Different errors, different copy: a failed request while offline (or any
 * fetch/network-shaped error) is presented as a connection problem with a
 * neutral tone, because it is usually the network and not the app; everything
 * else is a genuine error. Either way the user gets a way back to a working
 * screen rather than a stack trace. The raw error is logged, never shown; only a
 * short digest (Next's own reference id) is surfaced, for support.
 */
const NETWORK_HINTS = ['fetch', 'network', 'load failed', 'failed to load', 'connection', 'offline']

function looksLikeNetwork(error: Error): boolean {
  const haystack = `${error.name} ${error.message}`.toLowerCase()
  if (NETWORK_HINTS.some((hint) => haystack.includes(hint))) return true
  // A live offline state at the moment of failure is a strong signal on its own.
  return typeof navigator !== 'undefined' && navigator.onLine === false
}

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Observability: Next logs it server-side too, but this catches client-only
    // throws. Never rendered to the user.
    console.error(error)
  }, [error])

  const network = looksLikeNetwork(error)

  return (
    <StatusScreen
      tone={network ? 'neutral' : 'error'}
      icon={network ? <WifiOffGlyph /> : <AlertTriangleGlyph size="size-9" />}
      title={network ? 'Connection problem' : 'Something went wrong'}
      description={
        network
          ? 'We couldn’t reach DentaVue. Check your internet connection, then try again.'
          : 'An unexpected error interrupted this screen. You can try again, or head back to the home screen.'
      }
      footnote={error.digest ? `Reference: ${error.digest}` : undefined}
      actions={<RecoveryActions onRetry={reset} />}
    />
  )
}
