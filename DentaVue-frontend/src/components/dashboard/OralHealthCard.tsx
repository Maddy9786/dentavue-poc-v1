'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StartScanButton } from '@/components/scan/StartScanButton'
import { ScoreGauge } from './ScoreGauge'
import { useOralHealthIndex } from '@/features/dashboard/useOralHealthIndex'
import InfoIcon from '@/icons/info.svg'

/**
 * The hero card: Oral Health Index gauge, confidence, scan cadence, the three
 * trend stats, and the primary "Scan Now" action.
 *
 * DATA SOURCE — `useOralHealthIndex()` returns the signed-in user's REAL latest
 * scan (score, confidence, points, dates, trend stats from the AI analysis and
 * the server-side comparison), and falls back to the placeholder mock when
 * signed out, before the first scan, or while the analysis is still loading. The
 * card reads only from that object, so nothing here changed but the source.
 *
 * The confidence bar is a real `role="progressbar"` with min/now/max, not a
 * decorative div, so its value is exposed to assistive tech. Its green fill
 * width is driven by `confidence` — the placeholder now, the AI's confidence
 * once signed in. "Scan Now" opens the guided-scan prep flow (the camera lives
 * at the end of it) — same entry point as the bottom-nav scan tile. It keeps the
 * secondary (teal) fill with a white label per the client's request.
 */
export function OralHealthCard() {
  const { data } = useOralHealthIndex()
  const { score, max, condition, pointsFromLastScan, confidence, lastScan, nextScan, stats } = data

  return (
    <Card className="flex flex-col gap-lg">
      <div className="flex items-center justify-between gap-sm">
        <h2 className="flex items-center gap-xs text-h1 font-semibold text-foreground">
          <InfoIcon aria-hidden="true" className="size-5 text-foreground" />
          Oral Health Index
        </h2>
        {/* "Good condition" pill: 30px tall, 12px radius, 8/12 padding, teal
            fill, white text (#FFFFFF) per design — the white overrides the
            badge's AA-paired dark text. The label is data-driven (condition),
            so an AI-derived status renders here unchanged. */}
        <Badge tone="secondary" className="rounded-3 px-md py-sm text-surface">
          {condition}
        </Badge>
      </div>

      <div className="flex items-center gap-lg">
        <ScoreGauge
          score={score}
          max={max}
          condition={condition}
          pointsFromLastScan={pointsFromLastScan}
        />

        <div className="flex min-w-0 flex-1 flex-col gap-md">
          <div className="flex flex-col gap-xs">
            <span className="text-h2 text-foreground">Confidence score</span>
            <div className="flex items-center gap-sm">
              <div
                role="progressbar"
                aria-valuenow={confidence}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Confidence score"
                className="h-2 flex-1 overflow-hidden rounded-full bg-border"
              >
                <div className="h-full rounded-full bg-success" style={{ width: `${confidence}%` }} />
              </div>
              <span className="text-h2 font-semibold text-foreground">{confidence}%</span>
            </div>
          </div>

          {/* Last Scan on the left, Next Scan pushed to the right corner so it
              sits directly under the 92% confidence value above it. */}
          <dl className="flex items-start justify-between gap-md">
            <div className="flex flex-col">
              <dt className="text-body text-foreground-secondary">Last Scan</dt>
              <dd className="text-body font-medium text-foreground">{lastScan}</dd>
            </div>
            <div className="flex flex-col items-end text-right">
              <dt className="text-body text-foreground-secondary">Next Scan</dt>
              <dd className="text-body font-medium text-primary">{nextScan}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="flex border-t border-border pt-lg">
        {stats.map((stat, i) => (
          <div
            key={stat.label}
            className={`flex flex-1 flex-col gap-2xs px-sm ${i > 0 ? 'border-l border-border' : ''}`}
          >
            {/* Label: 12px / 18px, #736B61 (text-body = 0.75rem × 1.5 leading;
                text-foreground-secondary = #736B61). */}
            <span className="text-body text-foreground-secondary">{stat.label}</span>
            <span className="text-h1 font-semibold text-primary">{stat.value}</span>
            <span className="text-nav text-foreground-secondary">{stat.note}</span>
          </div>
        ))}
      </div>

      <StartScanButton label="Scan Now" variant="secondary" />
    </Card>
  )
}
