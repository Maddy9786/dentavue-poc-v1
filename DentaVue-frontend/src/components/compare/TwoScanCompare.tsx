import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SmileGlyph, ArrowDownGlyph } from '@/components/ui/StatusGlyphs'
import { ScanTile } from '@/components/scan/ScanTile'
import { ViewFullReportButton } from './ViewFullReportButton'
import type { CompareMetricTone, CompareTwoView } from '@/features/dashboard/mockDashboard'
import type { DisplayScan } from '@/features/scan/scanDisplay'

/**
 * The TWO-scan compare state: the latest two scans side by side, a plain-language
 * note, the metric-by-metric read-out, the next-scan banner, and the full-report
 * CTA. Presentational — the images come from `scans` (latest two) and the
 * read-out from `data`.
 *
 * Metric badges follow the design's colours: Improving is the teal accent (white
 * text, per the app's status treatment), Needs Attention is the red error pill
 * (bg-error #D80027, white text — AA 5.32:1), and Stable is a warm-grey pill
 * (bg-border #ECE7DF). The overall points delta is the same red alert pill.
 */
const METRIC_BADGE: Record<CompareMetricTone, { tone: 'secondary' | 'muted' | 'error'; className?: string }> = {
  improving: { tone: 'secondary', className: 'text-surface' },
  attention: { tone: 'error' },
  // bg-border is the warm-100 token = #ECE7DF; it overrides muted's cool grey.
  stable: { tone: 'muted', className: 'bg-border' },
}

export function TwoScanCompare({ scans, data }: { scans: DisplayScan[]; data: CompareTwoView }) {
  const { note, metrics, overall, nextScan, ctaLabel } = data

  return (
    <>
      {/* The two compared scans. */}
      <div className="grid grid-cols-2 gap-md">
        {scans.map((scan) => (
          <ScanTile key={scan.id} scan={scan} />
        ))}
      </div>

      {/* Plain-language summary of the change. */}
      <Card className="flex items-start gap-sm">
        <span className="shrink-0 text-foreground-secondary" aria-hidden="true">
          <SmileGlyph />
        </span>
        <p className="text-body text-foreground-secondary">{note}</p>
      </Card>

      {/* Metric-by-metric read-out, plus the overall delta. */}
      <Card>
        <ul className="flex flex-col divide-y divide-border">
          {metrics.map((metric) => {
            const badge = METRIC_BADGE[metric.tone]
            return (
              <li
                key={metric.id}
                className="flex items-center justify-between gap-sm py-md first:pt-0"
              >
                <span className="min-w-0 flex-1 truncate text-h2 font-medium text-foreground">
                  {metric.label}
                </span>
                <div className="flex shrink-0 items-center gap-sm">
                  <span className="text-h2 whitespace-nowrap text-foreground">
                    {metric.from} <span className="text-foreground-secondary">→</span> {metric.to}
                  </span>
                  <Badge tone={badge.tone} className={badge.className}>
                    {metric.badge}
                  </Badge>
                </div>
              </li>
            )
          })}

          {/* Overall — title + note on the left, the red points delta on the right. */}
          <li className="flex items-center justify-between gap-sm py-md last:pb-0">
            <div className="flex min-w-0 flex-col">
              <span className="text-h2 font-semibold text-foreground">{overall.title}</span>
              <span className="text-nav text-foreground-secondary">{overall.subtitle}</span>
            </div>
            <Badge tone="error" className="shrink-0 gap-2xs">
              {overall.direction === 'down' && <ArrowDownGlyph />}
              {overall.points} Points
            </Badge>
          </li>
        </ul>
      </Card>

      {/* Next scan — teal banner (white text per the design's fill treatment). */}
      <div className="rounded-4 bg-secondary px-lg py-md text-surface shadow-drop">
        <p className="text-h2 font-semibold">Next scan</p>
        <p className="text-body text-surface/90">
          {nextScan.inLabel} · {nextScan.date}
        </p>
      </div>

      <ViewFullReportButton label={ctaLabel} />
    </>
  )
}
