'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

/**
 * "View full results" — the Risk assessment CTA, opening the full scan-results
 * screen (the last screen of the guided-scan flow). NOT AI-insight and NOT
 * Compare: AI-insight is its own flow (Home's "See full analysis") and comparison
 * is its own (Home's "View Scan"). `push`, so Back returns to the risk summary.
 */
export function ViewFullResultsButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    // White label per the client's blue/white combination (below AA on the fill;
    // kept per client instruction, pending confirmation).
    <Button
      variant="primary"
      className="text-surface"
      onClick={() => router.push(ROUTES.patient.scanResults)}
    >
      {label}
    </Button>
  )
}
