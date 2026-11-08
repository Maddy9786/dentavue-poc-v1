'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

/**
 * The action stack for the not-found / error screens — "return to a working
 * screen", per the design. Kept in one client component so both routes offer the
 * same recovery and the pages themselves can stay server components.
 *
 *   - error boundary → pass `onRetry` (Next's `reset`): "Try again" re-renders
 *     the failed segment in place, returning the user to the very screen they
 *     were on. "Go to home" is the always-safe fallback.
 *   - not-found → pass `showBack`: "Go back" returns to the previous screen
 *     (real history when there is any, else home, so it is never a dead control),
 *     with "Go to home" beneath.
 *
 * Navigation via router.push matches how the rest of the app moves between
 * screens (e.g. ScanResultsContent). Buttons use the accessible fill/text pairs
 * from the design system.
 */
export function RecoveryActions({
  onRetry,
  showBack = false,
}: {
  onRetry?: () => void
  showBack?: boolean
}) {
  const router = useRouter()

  const goHome = () => router.push(ROUTES.home)
  const goBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(ROUTES.home)
  }

  return (
    <>
      {onRetry ? (
        <Button variant="primary" onClick={onRetry}>
          Try again
        </Button>
      ) : showBack ? (
        <Button variant="primary" onClick={goBack}>
          Go back
        </Button>
      ) : null}

      {/* Bordered surface — the app's secondary-action treatment (shadow removed,
          border-only), matching "Analyse anyway" / "Remind me" elsewhere. */}
      <Button
        variant="surface"
        className="border border-border text-foreground-secondary shadow-none"
        onClick={goHome}
      >
        Go to home
      </Button>
    </>
  )
}
