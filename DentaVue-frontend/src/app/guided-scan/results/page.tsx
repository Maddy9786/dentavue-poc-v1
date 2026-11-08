import type { Metadata } from 'next'
import { BackButton } from '@/components/ui/BackButton'
import { ScanResultsContent } from '@/components/scan/ScanResultsContent'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Scan results',
}

/**
 * Scan results — the final screen of the guided-scan flow (reached from the Risk
 * assessment's "View full results").
 *
 * A thin server shell: it owns the page metadata and the header, and defers the
 * whole body to ScanResultsContent, a client island that reads the real AI
 * analysis and falls back to placeholder content when there isn't one. Route-
 * protected by the flow's layout, and framed as wellness guidance, not diagnosis.
 *
 * The score ring + confidence read reuse the Home hero's treatment (ScoreGauge).
 */
export default function ScanResultsPage() {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full app-column flex-col gap-2xl px-lg pt-2xl pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Scan results</h1>
        </header>

        <ScanResultsContent />
      </div>
    </main>
  )
}
