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
  /** Reason shown on the badge when flagged (e.g. "Too Dark"). */
  flag?: string
}

/**
 * "Quality check" — the review screen after the four shots, before analysis.
 *
 * Each captured angle shows with a clarity badge: a green check (success-small)
 * when sharp, an amber reason pill when flagged. The clarity is REAL — computed
 * per shot on the capture canvas by `assessImageQuality` (darkness + blur), not a
 * placeholder. "Mouth too far / not in frame" is beyond client-side CV and falls
 * to the AI layer.
 *
 * Actions: "Retake N photo(s)" jumps straight to the first flagged shot; "Analyse
 * anyway" proceeds regardless. When nothing is flagged, a single "Analyse" CTA
 * shows. All copy is derived from the item statuses.
 *
 * The amber problem-marker uses `success-bg` for BOTH its background and text
 * (same colour, by request) — a solid amber pill; its label is a placeholder the
 * AI clarity layer will supply per image. The token's NAME is a known Figma
 * mislabel (it is the brown/amber #A05A00, not a success colour; see CLAUDE.md),
 * but its hex is exactly the design's "Too Dark" colour.
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
  const flaggedCount = items.filter((item) => item.status === 'retake').length
  const goodCount = items.length - flaggedCount

  const summaryTitle = `${goodCount} of ${items.length} look great`
  const summaryNote =
    flaggedCount === 0
      ? 'All your photos look sharp. You’re good to go.'
      : flaggedCount === 1
        ? 'One photo is a little dark. Retake it for the best analysis.'
        : `${flaggedCount} photos need another look. Retake them for the best analysis.`

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

        {/* Success summary. success-big renders white-on-green on the white card
            (its check is knocked out, showing the card through). */}
        <Card className="flex flex-col items-center gap-sm text-center">
          <SuccessBigIcon aria-hidden="true" className="size-16" />
          <h2 className="text-h1 font-semibold text-foreground">{summaryTitle}</h2>
          <p className="text-body text-foreground-secondary">{summaryNote}</p>
        </Card>

        {/* The four captured angles. */}
        <ul className="grid grid-cols-2 gap-md">
          {items.map((item) => {
            const flagged = item.status === 'retake'
            return (
              <li key={item.key} className="flex flex-col gap-xs">
                <div className="relative aspect-[4/3] overflow-hidden rounded-3 bg-border">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a data: URL from the capture canvas, not a remote asset. */}
                  <img
                    src={item.image}
                    alt={`Your ${item.label.toLowerCase()} photo`}
                    className="h-full w-full object-cover"
                  />
                  {flagged ? (
                    // Same colour for background and text — a solid amber
                    // problem-marker; the label ("Too Dark") is a placeholder the
                    // AI clarity layer will fill in (any/some/all images), kept
                    // here for reference.
                    <span className="absolute left-sm top-sm rounded-2 bg-success-bg px-sm py-2xs text-nav font-semibold text-success-bg">
                      {item.flag}
                    </span>
                  ) : (
                    <SuccessSmallIcon aria-hidden="true" className="absolute left-sm top-sm size-6" />
                  )}
                </div>
                <span className="text-body text-foreground">
                  {item.label} ·{' '}
                  <span className={cn(flagged ? 'font-medium text-success-bg' : 'text-foreground-secondary')}>
                    {flagged ? 'retake' : 'sharp'}
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
              {/* White label per the client's blue/white combination (below AA on
                  the fill; kept per client instruction, pending confirmation). */}
              <Button variant="primary" className="text-surface" onClick={() => onRetake(flaggedIndex)}>
                Retake {flaggedCount} photo{flaggedCount > 1 ? 's' : ''}
              </Button>
              <Button
                variant="surface"
                className="border border-border text-foreground-secondary shadow-none"
                onClick={onAnalyse}
              >
                Analyse anyway
              </Button>
            </>
          ) : (
            <Button variant="primary" className="text-surface" onClick={onAnalyse}>
              Analyse
            </Button>
          )}
        </div>
      </div>
    </main>
  )
}
