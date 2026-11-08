'use client'

import { useRouter } from 'next/navigation'
import { ROUTES } from '@/constants/routes'

/**
 * "View Scan" — the trailing action on Home's Compare Progress header. Rendered
 * as plain trailing text (matching the other section metas) but is a real button:
 * it navigates to the compare screen.
 *
 * Which compare view shows there depends on how many scans exist (single today;
 * two-up / latest-two later) — that decision lives in the /compare page, so this
 * control just opens the route.
 */
export function ViewScanButton() {
  const router = useRouter()

  return (
    <button
      type="button"
      onClick={() => router.push(ROUTES.patient.compare)}
      className="rounded-1 text-body font-medium text-foreground focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      View Scan
    </button>
  )
}
