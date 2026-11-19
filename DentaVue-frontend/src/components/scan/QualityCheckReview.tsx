'use client'

import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { BackButton } from '@/components/ui/BackButton'
import { ROUTES } from '@/constants/routes'
import type { ScanQualityStatus } from '@/features/dashboard/mockDashboard'
import SuccessBigIcon from '@/icons/success-big.svg'
import SuccessSmallIcon from '@/icons/success-small.svg'

export interface QualityCheckItem {
  key: string
  label: string
  /** data: URL of the captured shot. */
  image: string
  status: ScanQualityStatus
  /** Reason shown on the badge when flagged (e.g. "Too dark", "Blurry", "No mouth detected"). */
  flag?: string
}

/**
 * "Quality check" — the review screen after the four shots, before analysis.
 *
 * Each captured angle shows with a clarity badge: a green check (success-small)
 * when sharp and oral tissue is detected, or an amber reason pill when flagged.
 */
export function QualityCheckReview({
  items,
  total,
  onRetake,
  onAnalyse,
}: {
  items: QualityCheckItem[]
  /** Total steps in the flow, for the "N/N Captured" header. */
  total: number
  /** Jump to a flagged shot to retake it (index into the flow). */
  onRetake: (index: number) => void
  /** Proceed to analysis (uploads + routes on). */
  onAnalyse: () => void
}) {
  const flaggedIndex = items.findIndex((item) => item.status === 'retake')
  const flaggedItems = items.filter((item) => item.status === 'retake')
  const flaggedCount = flaggedItems.length
  const noMouthCount = flaggedItems.filter((item) => item.flag === 'No mouth detected').length
  const goodCount = items.length - flaggedCount
  const allInvalidOral = noMouthCount === items.length

  const summaryTitle =
    goodCount === 0
      ? 'Retake needed before analysis'
      : `${goodCount} of ${items.length} look great`

  const summaryNote =
    flaggedCount === 0
      ? 'All 4 mouth angles look clear and properly aligned. You’re ready for analysis.'
      : allInvalidOral
        ? 'We couldn’t detect a close-up of your teeth or gums in these photos. Please align your mouth inside the dashed guide and retake.'
        : noMouthCount > 0
          ? `${noMouthCount} photo${noMouthCount > 1 ? 's' : ''} didn’t clearly show your mouth inside the guide frame. Retake ${flaggedCount > 1 ? 'flagged photos' : 'it'} for accurate results.`
          : flaggedCount === 1
            ? `One photo looks ${flaggedItems[0]?.flag?.toLowerCase() ?? 'unclear'}. Retake it for the most accurate analysis.`
            : `${flaggedCount} photos need another look (${flaggedItems.map((f) => f.flag).filter(Boolean).join(', ')}). Retake them for the best analysis.`

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full app-column flex-1 flex-col gap-2xl px-lg pt-2xl pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.patient.guidedScan} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Quality check</h1>
          <span className="absolute right-0 text-body text-foreground-secondary">
            {items.length}/{total} Captured
          </span>
        </header>

        {/* Summary card */}
        <Card className="flex flex-col items-center gap-sm text-center">
          <SuccessBigIcon aria-hidden="true" className="size-16" />
          <h2 className="text-h1 font-semibold text-foreground">{summaryTitle}</h2>
          <p className="text-body text-foreground-secondary">{summaryNote}</p>
        </Card>

        {/* The four captured angles — clicking any card lets the user retake that specific angle */}
        <ul className="grid grid-cols-2 gap-md">
          {items.map((item, idx) => {
            const flagged = item.status === 'retake'
            return (
              <li key={item.key} className="flex flex-col gap-xs">
                <button
                  type="button"
                  onClick={() => onRetake(idx)}
                  aria-label={`Retake ${item.label} photo`}
                  className={cn(
                    'group relative aspect-[4/3] overflow-hidden rounded-3 bg-border text-left transition-all',
                    flagged ? 'ring-2 ring-success-bg' : 'hover:ring-2 hover:ring-primary',
                  )}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the capture canvas */}
                  <img
                    src={item.image}
                    alt={`Your ${item.label.toLowerCase()} photo`}
                    className="h-full w-full object-cover"
                  />
                  {flagged ? (
                    <span className="absolute left-sm top-sm rounded-2 bg-success-bg px-sm py-2xs text-nav font-semibold text-surface shadow-sm">
                      ⚠️ {item.flag ?? 'Retake'}
                    </span>
                  ) : (
                    <SuccessSmallIcon aria-hidden="true" className="absolute left-sm top-sm size-6" />
                  )}
                  <span className="absolute bottom-xs right-xs rounded bg-foreground/75 px-xs py-2xs text-nav text-surface opacity-90 group-hover:opacity-100">
                    Tap to retake
                  </span>
                </button>
                <span className="text-body text-foreground">
                  {item.label} ·{' '}
                  <span className={cn(flagged ? 'font-semibold text-success-bg' : 'text-foreground-secondary')}>
                    {flagged ? item.flag ?? 'retake' : 'clear & aligned'}
                  </span>
                </span>
              </li>
            )
          })}
        </ul>

        {/* Actions, pinned to the bottom. */}
        <div className="mt-auto flex flex-col gap-sm pt-lg">
          {flaggedCount > 0 ? (
            <>
              <Button variant="primary" className="text-surface" onClick={() => onRetake(flaggedIndex)}>
                Retake {flaggedCount} flagged photo{flaggedCount > 1 ? 's' : ''}
              </Button>
              {!allInvalidOral && (
                <Button
                  variant="surface"
                  className="border border-border text-foreground-secondary shadow-none"
                  onClick={onAnalyse}
                >
                  Analyse anyway ({goodCount} clear photo{goodCount === 1 ? '' : 's'})
                </Button>
              )}
            </>
          ) : (
            <Button variant="primary" className="text-surface" onClick={onAnalyse}>
              Analyse Scan
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
