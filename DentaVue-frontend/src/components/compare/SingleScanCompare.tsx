import { Card } from '@/components/ui/Card'
import { CheckGlyph, AlertCircleGlyph, TrendUpGlyph, ScanFrameGlyph } from '@/components/ui/StatusGlyphs'
import { ScanTile } from '@/components/scan/ScanTile'
import { StartScanButton } from '@/components/scan/StartScanButton'
import { compareSingle } from '@/features/dashboard/mockDashboard'
import type { DisplayScan } from '@/features/scan/scanDisplay'

/**
 * The SINGLE-scan compare state: one scan on record (or none — a blank
 * placeholder), beside an empty "Next Scan" tile, with the copy explaining what
 * a second scan unlocks.
 *
 * `scan` is the real (or placeholder) image; the surrounding copy — the unlock
 * note, the "What you'll see" checklist, the CTA — is still placeholder from
 * `compareSingle` (it's guidance, not per-scan data).
 */
export function SingleScanCompare({ scan }: { scan: DisplayScan }) {
  const { nextScanDue, unlockTitle, unlockBody, whatYouWillSee, ctaLabel } = compareSingle

  return (
    <>
      {/* The scan (or placeholder) beside the not-yet-taken next scan. */}
      <Card>
        <div className="grid grid-cols-2 gap-md">
          <ScanTile scan={scan} />

          <div className="flex flex-col gap-xs">
            {/* Empty placeholder for the second scan — not an image yet. */}
            <div className="flex aspect-square flex-col items-center justify-center gap-sm rounded-3 bg-border text-foreground-secondary">
              <ScanFrameGlyph />
              <span className="text-body font-medium">Next Scan</span>
            </div>
            <span className="text-body text-foreground-secondary">{nextScanDue}</span>
          </div>
        </div>
      </Card>

      {/* What a second scan unlocks. */}
      <Card className="flex flex-col items-center gap-sm text-center">
        <span
          className="grid size-8 shrink-0 place-items-center rounded-2 bg-border text-foreground"
          aria-hidden="true"
        >
          <TrendUpGlyph />
        </span>
        <h2 className="text-h1 font-semibold text-foreground">{unlockTitle}</h2>
        <p className="text-body text-foreground-secondary">{unlockBody}</p>
      </Card>

      {/* What you'll see — the payoff checklist. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h1 font-semibold text-foreground">What you&apos;ll see</h2>
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {whatYouWillSee.map((item) => (
              <li key={item.id} className="flex items-center gap-md py-sm first:pt-0 last:pb-0">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-2 bg-border text-foreground"
                  aria-hidden="true"
                >
                  {item.done ? <CheckGlyph /> : <AlertCircleGlyph />}
                </span>
                <span className="text-body text-foreground">{item.label}</span>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      <StartScanButton label={ctaLabel} />
    </>
  )
}
