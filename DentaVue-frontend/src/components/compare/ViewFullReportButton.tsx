'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'

/**
 * "View full report" — the two-scan compare's primary CTA. Opens the full
 * AI-insight write-up (/ai-insight), the detailed report behind the summary
 * metrics on this screen.
 */
export function ViewFullReportButton({ label }: { label: string }) {
  const router = useRouter()

  return (
    // Primary blue + white per the client's combination (below AA on the fill;
    // kept per client instruction, pending confirmation).
    <Button
      variant="primary"
      className="text-surface"
      onClick={() => router.push(ROUTES.patient.aiInsight)}
    >
      {label}
    </Button>
  )
}
