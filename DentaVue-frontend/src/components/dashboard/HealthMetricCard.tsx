import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { HealthMetric } from '@/features/dashboard/mockDashboard'

interface AreaVisualConfig {
  chipBg: string
  chipText: string
  accentBar: string
  categoryTag: string
  icon: ReactNode
}

function getAreaVisual(metric: HealthMetric): AreaVisualConfig {
  const key = `${metric.id} ${metric.title}`.toLowerCase()

  if (key.includes('gum-line') || key.includes('gum line')) {
    return {
      chipBg: 'bg-indigo-50 border border-indigo-200/70',
      chipText: 'text-indigo-600',
      accentBar: 'from-indigo-500 to-blue-500',
      categoryTag: 'Alignment',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 7c3 0 3 3 6 3s3-3 6-3 3 3 6 3" />
          <path d="M5 10v7a3 3 0 0 0 6 0v-7" />
          <path d="M13 10v7a3 3 0 0 0 6 0v-7" />
        </svg>
      ),
    }
  }

  if (key.includes('gum')) {
    return {
      chipBg: 'bg-rose-50 border border-rose-200/70',
      chipText: 'text-rose-600',
      accentBar: 'from-rose-500 to-pink-500',
      categoryTag: 'Gums',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
        </svg>
      ),
    }
  }

  if (key.includes('enamel') || key.includes('strength')) {
    return {
      chipBg: 'bg-sky-50 border border-sky-200/70',
      chipText: 'text-sky-600',
      accentBar: 'from-sky-500 to-blue-600',
      categoryTag: 'Protection',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      ),
    }
  }

  if (key.includes('tissue') || key.includes('tongue') || key.includes('cheek')) {
    return {
      chipBg: 'bg-purple-50 border border-purple-200/70',
      chipText: 'text-purple-600',
      accentBar: 'from-purple-500 to-violet-600',
      categoryTag: 'Freshness',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 3c-4.5 0-7 3-7 7.5 0 5.5 3 10.5 7 10.5s7-5 7-10.5C19 6 16.5 3 12 3z" />
          <path d="M12 3v11" />
        </svg>
      ),
    }
  }

  if (key.includes('tartar') || key.includes('stain')) {
    return {
      chipBg: 'bg-amber-50 border border-amber-200/70',
      chipText: 'text-amber-600',
      accentBar: 'from-amber-500 to-orange-500',
      categoryTag: 'Surface Shine',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="m12 3-1.9 5.8a2 2 0 0 1-1.3 1.3L3 12l5.8 1.9a2 2 0 0 1 1.3 1.3L12 21l1.9-5.8a2 2 0 0 1 1.3-1.3L21 12l-5.8-1.9a2 2 0 0 1-1.3-1.3L12 3Z" />
        </svg>
      ),
    }
  }

  // Default: Tooth Cleanliness / Plaque
  return {
    chipBg: 'bg-teal-50 border border-teal-200/70',
    chipText: 'text-teal-600',
    accentBar: 'from-teal-500 to-emerald-500',
    categoryTag: 'Daily Clean',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3C4.8 3 3 4.8 3 7c0 2.4 1.2 4.5 2 7 .7 2.2 1.2 7 3 7 1.4 0 2-3.5 4-3.5s2.6 3.5 4 3.5c1.8 0 2.3-4.8 3-7 .8-2.5 2-4.6 2-7 0-2.2-1.8-4-4-4-1.8 0-3.2 1-5 1S8.8 3 7 3Z" />
      </svg>
    ),
  }
}

/**
 * Rich, visual tile in the "Your mouth at a glance" 6-area grid:
 * - Distinct colour-coded custom icon & category tag for each of the 6 areas
 * - 4-segment visual health meter showing status strength at a glance
 * - Colour-differentiated status pill (Amber for Watch, Emerald for Improving, Teal for Healthy)
 */
export function HealthMetricCard({ metric }: { metric: HealthMetric }) {
  const visual = getAreaVisual(metric)
  const isNotScanned = metric.status === 'Not scanned'
  const isWatch = metric.tone === 'watch' || metric.status === 'Watch'
  const isImproving = metric.status === 'Improving'

  const filledBars = isNotScanned ? 0 : isWatch ? 2 : 4

  const trendLabel = isNotScanned
    ? 'Awaiting scan'
    : isImproving
      ? `↑ ${metric.trend === 'stable' ? 'Improving' : `+${metric.trend}`}`
      : isWatch
        ? 'Needs care'
        : metric.trend === 'stable'
          ? '✓ Steady'
          : `↑ +${metric.trend}`

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col gap-sm overflow-hidden p-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        isWatch
          ? 'border border-amber-300/80 bg-gradient-to-b from-amber-50/40 to-surface'
          : 'border border-border/80',
      )}
    >
      {/* Top colour accent strip */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          isNotScanned
            ? 'from-border to-border'
            : isWatch
              ? 'from-amber-400 to-orange-500'
              : visual.accentBar,
        )}
      />

      {/* Icon chip + category badge */}
      <div className="flex items-center justify-between gap-xs pt-2xs">
        <span
          aria-hidden="true"
          className={cn(
            'grid size-10 shrink-0 place-items-center rounded-3 shadow-2xs',
            visual.chipBg,
            visual.chipText,
          )}
        >
          {visual.icon}
        </span>

        <span
          className={cn(
            'rounded-full px-sm py-2xs text-[11px] font-semibold tracking-wide',
            isNotScanned
              ? 'bg-border/70 text-foreground-secondary'
              : isWatch
                ? 'bg-amber-100 text-amber-800'
                : isImproving
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-teal-50 text-teal-700',
          )}
        >
          {trendLabel}
        </span>
      </div>

      {/* Area Title & Plain-English Description */}
      <div className="flex flex-col gap-2xs">
        <h3 className="text-h2 font-semibold text-foreground">{metric.title}</h3>
        <p className="text-body leading-snug text-foreground-secondary">{metric.description}</p>
      </div>

      {/* 4-Segment Visual Health Meter + Status Dot */}
      <div className="mt-auto flex flex-col gap-xs pt-xs">
        <div className="flex items-center gap-1" aria-hidden="true">
          {[0, 1, 2, 3].map((barIdx) => {
            const active = barIdx < filledBars
            return (
              <span
                key={barIdx}
                className={cn(
                  'h-1.5 flex-1 rounded-full transition-colors',
                  !active
                    ? 'bg-border'
                    : isWatch
                      ? 'bg-amber-400'
                      : isImproving
                        ? 'bg-emerald-500'
                        : 'bg-secondary',
                )}
              />
            )
          })}
        </div>

        <div className="flex items-center justify-between gap-xs">
          <span className="inline-flex items-center gap-xs">
            <span
              aria-hidden="true"
              className={cn(
                'size-2 shrink-0 rounded-full',
                isNotScanned
                  ? 'bg-foreground-secondary/40'
                  : isWatch
                    ? 'animate-pulse bg-amber-500'
                    : isImproving
                      ? 'bg-emerald-500'
                      : 'bg-secondary',
              )}
            />
            <span
              className={cn(
                'text-body font-semibold',
                isNotScanned
                  ? 'text-foreground-secondary'
                  : isWatch
                    ? 'text-amber-700'
                    : isImproving
                      ? 'text-emerald-700'
                      : 'text-secondary',
              )}
            >
              {metric.status}
            </span>
          </span>

          <span className="text-[11px] font-medium text-foreground-secondary">
            {visual.categoryTag}
          </span>
        </div>
      </div>
    </Card>
  )
}
