import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { StatusIndicator } from './StatusIndicator'
import type { HealthMetric } from '@/features/dashboard/mockDashboard'
import ToothGlanceIcon from '@/icons/tooth-glance.svg'

/**
 * One tile in the "Your mouth at a glance" grid: the tooth-glance chip (a
 * self-contained icon with its own box), the area name and a short read, then a
 * status line (dot + word) and a trend pill.
 *
 * Rendered from the `metric` prop alone, so the grid can hold however many the
 * AI returns (1–5) without changes here.
 */
export function HealthMetricCard({ metric }: { metric: HealthMetric }) {
  return (
    <Card className="flex h-full flex-col gap-sm p-md">
      <ToothGlanceIcon aria-hidden="true" className="size-9" />

      <div className="flex flex-col gap-2xs">
        <h3 className="text-h2 font-semibold text-foreground">{metric.title}</h3>
        <p className="text-body text-foreground-secondary">{metric.description}</p>
      </div>

      <div className="mt-auto flex items-center justify-between gap-sm pt-xs">
        <StatusIndicator tone={metric.tone} label={metric.status} />
        {/* text-surface (#FFFFFF) overrides the badge's AA-paired dark text as
            requested. White on this teal is ~2.5:1 and fails WCAG AA — kept per
            request. */}
        <Badge tone="secondary" className="text-surface">
          {metric.trend}
        </Badge>
      </div>
    </Card>
  )
}
