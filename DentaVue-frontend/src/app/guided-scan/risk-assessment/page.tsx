import type { Metadata } from 'next'
import { BackButton } from '@/components/ui/BackButton'
import { ViewFullResultsButton } from '@/components/scan/ViewFullResultsButton'
import { RiskAreas } from '@/components/scan/RiskAreas'
import { riskAssessment } from '@/features/dashboard/mockDashboard'
import { ROUTES } from '@/constants/routes'
import SuccessBigIcon from '@/icons/success-big.svg'

export const metadata: Metadata = {
  title: 'Risk assessment',
}

/**
 * Risk assessment — the AI summary shown after analysing: one row per tracked
 * area with a risk level, then "View full results".
 *
 * A server shell: the static copy renders here, and the tracked-area rows are a
 * client island (RiskAreas) that reads the real AI analysis and falls back to
 * the placeholder rows when there isn't one. Route-protected by the flow's
 * layout, and framed as wellness guidance, not diagnosis. Layout mirrors the
 * other flow screens.
 */
export default function RiskAssessmentPage() {
  const { completeTitle, completeSubtitle, ctaLabel, items } = riskAssessment

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      {/* Same top margin and gaps as the Guided Scan prep screen. */}
      <div className="mx-auto flex w-full app-column flex-1 flex-col gap-2xl px-lg pt-14 pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Risk assessment</h1>
        </header>

        {/* Completion header. success-big renders as a green disc with a knocked-out
            check (the background shows through). */}
        <div className="flex flex-col items-center gap-sm text-center">
          <SuccessBigIcon aria-hidden="true" className="size-16" />
          <h2 className="text-h1 font-semibold text-foreground">{completeTitle}</h2>
          <p className="text-body text-foreground-secondary">{completeSubtitle}</p>
        </div>

        {/* Tracked areas — real analysis when there is one, placeholder otherwise. */}
        <RiskAreas fallback={items} />

        {/* Same button placement as the Guided Scan screen (pt-30, not bottom-pinned). */}
        <div className="pt-30">
          <ViewFullResultsButton label={ctaLabel} />
        </div>
      </div>
    </main>
  )
}
