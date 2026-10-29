'use client'

import type { ComponentType, SVGProps } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { ScanUnclearNotice } from '@/components/scan/ScanUnclearNotice'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import type { RiskItem } from '@/features/dashboard/mockDashboard'
import OneIcon from '@/icons/one.svg'
import TwoIcon from '@/icons/two.svg'
import ThreeIcon from '@/icons/three.svg'
import FourIcon from '@/icons/four.svg'

/** Number chips 1–4 — self-contained Figma exports (own box + digit). */
const NUMBER_ICONS: ComponentType<SVGProps<SVGSVGElement>>[] = [OneIcon, TwoIcon, ThreeIcon, FourIcon]

/**
 * The tracked-area rows on the Risk assessment screen.
 *
 * A client island so it can read the real AI analysis, falling back to the
 * placeholder rows when there isn't one (signed out, no scans, still analysing,
 * or the analysis failed). The parent page stays a server component.
 *
 * The levels shown here are NOT model output. Gemini reports a raw severity per
 * area; the backend bands it — with hysteresis against the previous scan — and
 * maps the band to Low / Medium / Attention. That is what stops a re-scan of the
 * same mouth flipping a row between "Low" and "Medium" on model noise alone.
 */
export function RiskAreas({ fallback }: { fallback: RiskItem[] }) {
  const { analysis, error } = useScanAnalysis()

  // Unreadable/failed scan → the retake state in place of the tracked-area rows,
  // so the first screen after analysing doesn't show placeholder "Low / Low"
  // levels for a scan that saw nothing. Signed out, `error` is null.
  if (error) {
    return <ScanUnclearNotice message={error} />
  }

  const items = analysis?.risk.length ? analysis.risk : fallback

  return (
    <Card>
      <ol className="flex flex-col divide-y divide-border">
        {items.map((item, i) => {
          // More areas than chips would crash on a missing icon; the backend
          // sends four, but a contract change should degrade, not throw.
          const NumberChip = NUMBER_ICONS[i % NUMBER_ICONS.length]!
          return (
            <li key={item.id} className="flex items-center gap-md py-md first:pt-0 last:pb-0">
              <NumberChip aria-hidden="true" className="size-8 shrink-0" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-h2 font-semibold text-foreground">{item.title}</span>
                <span className="text-body text-foreground-secondary">{item.detail}</span>
              </div>
              {item.tone === 'attention' ? (
                // Amber "Attention" — white on amber is AA (5.31:1).
                <Badge tone="attention" className="shrink-0 rounded-3 px-md py-sm text-body">
                  {item.level}
                </Badge>
              ) : (
                // Teal for Low / Medium. The design draws white text here (below
                // AA on the fill; kept per client instruction, pending confirmation).
                <Badge
                  tone="secondary"
                  className="shrink-0 rounded-3 px-md py-sm text-body text-surface"
                >
                  {item.level}
                </Badge>
              )}
            </li>
          )
        })}
      </ol>
    </Card>
  )
}
