'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'

/**
 * "View full results" — the Risk assessment CTA, opening the full scan-results
 * screen (the last screen of the guided-scan flow). Hidden when the scan failed
 * validation so the user is directed cleanly to "Retake scan".
 */
export function ViewFullResultsButton({ label }: { label: string }) {
  const router = useRouter()
  const { error } = useScanAnalysis()

  if (error) return null

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
