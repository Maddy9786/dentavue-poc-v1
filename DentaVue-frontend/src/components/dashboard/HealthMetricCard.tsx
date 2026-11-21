import type { ReactNode } from 'react'
import { Card } from '@/components/ui/Card'
import { cn } from '@/lib/cn'
import type { HealthMetric } from '@/features/dashboard/mockDashboard'

interface AreaVisualConfig {
  chipBg: string
  chipText: string
  accentBar: string
  pillBg: string
  pillText: string
  barBg: string
  dotBg: string
  statusText: string
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
      pillBg: 'bg-indigo-50',
      pillText: 'text-indigo-700',
      barBg: 'bg-indigo-500',
      dotBg: 'bg-indigo-500',
      statusText: 'text-indigo-700',
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
      pillBg: 'bg-rose-50',
      pillText: 'text-rose-700',
      barBg: 'bg-rose-500',
      dotBg: 'bg-rose-500',
      statusText: 'text-rose-700',
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
      pillBg: 'bg-sky-50',
      pillText: 'text-sky-700',
      barBg: 'bg-sky-500',
      dotBg: 'bg-sky-500',
      statusText: 'text-sky-700',
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
      pillBg: 'bg-purple-50',
      pillText: 'text-purple-700',
      barBg: 'bg-purple-500',
      dotBg: 'bg-purple-500',
      statusText: 'text-purple-700',
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
      pillBg: 'bg-amber-50',
      pillText: 'text-amber-700',
      barBg: 'bg-amber-500',
      dotBg: 'bg-amber-500',
      statusText: 'text-amber-700',
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
    pillBg: 'bg-teal-50',
    pillText: 'text-teal-700',
    barBg: 'bg-teal-500',
    dotBg: 'bg-teal-500',
    statusText: 'text-teal-700',
    categoryTag: 'Daily Clean',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" className="size-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M7 3C4.8 3 3 4.8 3 7c0 2.4 1.2 4.5 2 7 .7 2.2 1.2 7 3 7 1.4 0 2-3.5 4-3.5s2.6 3.5 4 3.5c1.8 0 2.3-4.8 3-7 .8-2.5 2-4.6 2-7 0-2.2-1.8-4-4-4-1.8 0-3.2 1-5 1S8.8 3 7 3Z" />
      </svg>
    ),
  }
}

function isMildObservation(description: string): boolean {
  const text = description.toLowerCase()
  return (
    text.includes('slight') ||
    text.includes('minor') ||
    text.includes('light ') ||
    text.includes('thin film') ||
    text.includes('trace')
  )
}

function getSpectrumMarker(
  metric: HealthMetric,
  severity?: number,
): {
  isNotScanned: boolean
  isWatch: boolean
  isImproving: boolean
  positionPct: number
  dotClass: string
  textClass: string
  pointerBorder: string
  pillClass: string
  pillLabel: string
} {
  const isNotScanned = metric.status === 'Not scanned'
  const isWatch = metric.tone === 'watch' || metric.status === 'Watch'
  const isImproving = metric.status === 'Improving'
  const isNormal = metric.status === 'Normal'
  const isMild = !isNotScanned && !isWatch && isMildObservation(metric.description)
  const isMarked =
    isWatch &&
    ((typeof severity === 'number' && severity >= 70) ||
      metric.description.toLowerCase().includes('pronounced') ||
      metric.description.toLowerCase().includes('heavy') ||
      metric.description.toLowerCase().includes('distinct'))

  // Use the real-time per-area severity (0 = 100% healthy on right, 100 = 0% on left)
  // clamped to [8, 94] so the circular thumb stays cleanly inside the track.
  const realPct =
    typeof severity === 'number' ? Math.max(8, Math.min(94, Math.round(100 - severity))) : null

  if (isNotScanned) {
    return {
      isNotScanned: true,
      isWatch: false,
      isImproving: false,
      positionPct: 0,
      dotClass: 'bg-foreground-secondary/40',
      textClass: 'text-foreground-secondary',
      pointerBorder: 'border-foreground-secondary',
      pillClass: 'bg-border/70 text-foreground-secondary',
      pillLabel: 'Awaiting scan',
    }
  }

  if (isMarked) {
    return {
      isNotScanned: false,
      isWatch: true,
      isImproving: false,
      positionPct: realPct ?? 14,
      dotClass: 'animate-pulse bg-rose-500',
      textClass: 'text-rose-700',
      pointerBorder: 'border-rose-600',
      pillClass: 'bg-rose-100 text-rose-800',
      pillLabel: 'Attention',
    }
  }

  if (isWatch) {
    return {
      isNotScanned: false,
      isWatch: true,
      isImproving: false,
      positionPct: realPct ?? 38,
      dotClass: 'animate-pulse bg-orange-500',
      textClass: 'text-orange-700',
      pointerBorder: 'border-orange-500',
      pillClass: 'bg-amber-100 text-amber-800',
      pillLabel: 'Needs care',
    }
  }

  if (isImproving) {
    return {
      isNotScanned: false,
      isWatch: false,
      isImproving: true,
      positionPct: realPct ?? (isMild ? 78 : 92),
      dotClass: 'bg-emerald-500',
      textClass: 'text-emerald-700',
      pointerBorder: 'border-emerald-600',
      pillClass: 'bg-emerald-100 text-emerald-800',
      pillLabel: `↑ ${metric.trend === 'stable' ? 'Improving' : `+${metric.trend}`}`,
    }
  }

  if (isNormal) {
    return {
      isNotScanned: false,
      isWatch: false,
      isImproving: false,
      positionPct: realPct ?? (isMild ? 68 : 86),
      dotClass: 'bg-teal-500',
      textClass: 'text-teal-700',
      pointerBorder: 'border-teal-600',
      pillClass: 'bg-teal-50 text-teal-700',
      pillLabel: metric.trend === 'stable' ? '✓ Normal' : `↑ +${metric.trend}`,
    }
  }

  return {
    isNotScanned: false,
    isWatch: false,
    isImproving: false,
    positionPct: realPct ?? (isMild ? 76 : 92),
    dotClass: 'bg-emerald-500',
    textClass: 'text-emerald-700',
    pointerBorder: 'border-emerald-600',
    pillClass: 'bg-emerald-100 text-emerald-800',
    pillLabel: metric.trend === 'stable' ? '✓ Healthy' : `↑ +${metric.trend}`,
  }
}

/**
 * Rich, visual tile in the "Your mouth at a glance" 6-area grid:
 * - Distinct colour-coded icon & top accent strip per area
 * - Medical gradient spectrum bar (Red → Yellow → Green) with a live pointer
 *   driven by the area's real-time scan score
 */
export function HealthMetricCard({
  metric,
  severity,
}: {
  metric: HealthMetric
  severity?: number
}) {
  const visual = getAreaVisual(metric)
  const marker = getSpectrumMarker(metric, severity)

  return (
    <Card
      className={cn(
        'relative flex h-full flex-col gap-sm overflow-hidden p-md transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        marker.isWatch
          ? 'border border-amber-300/80 bg-gradient-to-b from-amber-50/40 to-surface'
          : 'border border-border/80',
      )}
    >
      {/* Top colour accent strip */}
      <span
        aria-hidden="true"
        className={cn(
          'absolute inset-x-0 top-0 h-1 bg-gradient-to-r',
          marker.isNotScanned
            ? 'from-border to-border'
            : marker.isWatch
              ? 'from-amber-400 to-orange-500'
              : visual.accentBar,
        )}
      />

      {/* Icon chip + status badge */}
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
            marker.pillClass,
          )}
        >
          {marker.pillLabel}
        </span>
      </div>

      {/* Area Title & Plain-English Description */}
      <div className="flex flex-col gap-2xs">
        <h3 className="text-h2 font-semibold text-foreground">{metric.title}</h3>
        <p className="text-body leading-snug text-foreground-secondary">{metric.description}</p>
      </div>

      {/* Medical Spectrum Bar (Red → Yellow → Green) + Live Pointer */}
      <div className="mt-auto flex flex-col gap-xs pt-xs">
        <div className="relative flex h-3.5 items-center" aria-hidden="true">
          {marker.isNotScanned ? (
            <div className="h-2 w-full rounded-full bg-border" />
          ) : (
            <>
              <div className="h-2 w-full rounded-full bg-gradient-to-r from-rose-500 via-amber-400 to-emerald-500 opacity-90" />
              <span
                className={cn(
                  'absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-surface shadow-sm transition-all duration-300',
                  marker.pointerBorder,
                )}
                style={{ left: `${marker.positionPct}%` }}
              />
            </>
          )}
        </div>

        <div className="flex items-center justify-between gap-xs">
          <span className="inline-flex items-center gap-xs">
            <span
              aria-hidden="true"
              className={cn('size-2 shrink-0 rounded-full', marker.dotClass)}
            />
            <span className={cn('text-body font-semibold', marker.textClass)}>{metric.status}</span>
          </span>

          <span className="text-[11px] font-medium text-foreground-secondary">
            {visual.categoryTag}
          </span>
        </div>
      </div>
    </Card>
  )
}
