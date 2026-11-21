'use client'

import { useState } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CheckGlyph } from '@/components/ui/StatusGlyphs'
import { ScanShowcase } from '@/components/scan/ScanShowcase'
import { ScanUnclearNotice } from '@/components/scan/ScanUnclearNotice'
import { RescanReminderButton } from '@/components/insight/RescanReminderButton'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import { useGetScansQuery } from '@/features/scan/scansApi'
import { formatScanDate } from '@/features/scan/scanDisplay'
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/store/hooks'
import { cn } from '@/lib/cn'
import { aiInsightDetail, type InsightAction } from '@/features/dashboard/mockDashboard'
import AiInsightIcon from '@/icons/ai-insight.svg'

/**
 * Personal Care Guide — warm, interactive, everyday oral care plan tailored
 * to the user's latest scan.
 */
export function AiInsightContent() {
  const { analysis, error } = useScanAnalysis()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const currentUser = useAppSelector(selectCurrentUser)
  const { data: scans } = useGetScansQuery(undefined, { skip: !isAuthenticated })

  // Interactive daily checklist state so users can tick off their care habits today
  const [checkedIds, setCheckedIds] = useState<Record<string, boolean>>({})

  if (error) {
    return <ScanUnclearNotice message={error} />
  }

  const firstName = currentUser?.firstName?.trim()
  const scan = analysis ? scans?.find((entry) => entry.id === analysis.scanId) : undefined
  const updatedLabel = scan ? formatScanDate(scan.capturedAt) : aiInsightDetail.updated

  const written = analysis?.narrative?.insight ?? null

  const title = written?.title ?? aiInsightDetail.title
  const status = written?.status ?? aiInsightDetail.status
  const summary = written?.summary ?? aiInsightDetail.summary
  const likelyCauses = written?.likelyCauses.length
    ? written.likelyCauses
    : aiInsightDetail.likelyCauses
  const caution = written?.caution ?? aiInsightDetail.caution
  const confidence = analysis?.confidence ?? aiInsightDetail.confidence

  const clarityLabel =
    confidence >= 80 ? 'Clear & detailed' : confidence >= 60 ? 'Good lighting' : 'Provisional'

  const baseActions: InsightAction[] = analysis?.narrative?.actions.length
    ? analysis.narrative.actions.map((action) => ({
        id: action.id,
        title: action.title,
        detail: action.detail,
        done: false,
      }))
    : aiInsightDetail.whatToDo.map((a) => ({ ...a, done: false }))

  const whatToDo: InsightAction[] = [
    ...baseActions,
    {
      id: 'water-rinse',
      title: 'Rinse with plain water after tea, coffee or meals',
      detail: 'A quick 5-second swish keeps teeth fresh and protects enamel between brushes',
      done: false,
    },
  ]

  const completedCount = whatToDo.filter((a) => checkedIds[a.id]).length

  const toggleAction = (id: string) => {
    setCheckedIds((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <>
      {/* Warm personal welcome banner */}
      <div className="rounded-4 border border-secondary/30 bg-gradient-to-br from-secondary/10 via-surface to-primary/5 p-md">
        <p className="text-h2 font-semibold text-foreground">
          {firstName ? `Hi ${firstName}, here’s your gentle care plan` : 'Your gentle daily care plan'}
        </p>
        <p className="mt-2xs text-body text-foreground-secondary">
          Small, comfortable daily steps make the biggest difference for your gums and smile. Take it
          one easy habit at a time.
        </p>
      </div>

      {/* Summary card */}
      <Card className="flex flex-col gap-md">
        <div className="flex items-start gap-sm">
          <AiInsightIcon aria-hidden="true" className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-h2 font-semibold text-foreground">{title}</h2>
            <span className="text-nav text-foreground-secondary">
              Updated {updatedLabel} · Photo clarity {confidence}% ({clarityLabel})
            </span>
          </div>
          <Badge tone="secondary" className="shrink-0 text-surface">
            {status}
          </Badge>
        </div>
        <p className="text-body leading-relaxed text-foreground-secondary">{summary}</p>
      </Card>

      {/* What the scan shows */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h1 font-semibold text-foreground">What we noticed in your photos</h2>
        <ScanShowcase />
      </section>

      {/* Interactive Daily Care Routine */}
      <section className="flex flex-col gap-md">
        <div className="flex items-baseline justify-between gap-sm">
          <h2 className="text-h1 font-semibold text-foreground">Your easy daily care steps</h2>
          <span className="text-nav font-semibold text-secondary">
            {completedCount} of {whatToDo.length} done today
          </span>
        </div>

        {/* Mini progress bar */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-border" aria-hidden="true">
          <div
            className="h-full rounded-full bg-secondary transition-all duration-300"
            style={{ width: `${Math.round((completedCount / whatToDo.length) * 100)}%` }}
          />
        </div>

        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {whatToDo.map((action) => {
              const checked = Boolean(checkedIds[action.id])
              return (
                <li key={action.id} className="py-sm first:pt-0 last:pb-0">
                  <button
                    type="button"
                    onClick={() => toggleAction(action.id)}
                    aria-pressed={checked}
                    className="flex w-full items-start gap-md text-left"
                  >
                    <span
                      className={cn(
                        'grid size-8 shrink-0 place-items-center rounded-2 border transition-colors',
                        checked
                          ? 'border-secondary bg-secondary text-surface'
                          : 'border-border bg-background text-foreground-secondary',
                      )}
                      aria-hidden="true"
                    >
                      {checked ? <CheckGlyph /> : <span className="size-2.5 rounded-full bg-border" />}
                    </span>
                    <div className="flex flex-col">
                      <span
                        className={cn(
                          'text-body font-semibold transition-colors',
                          checked ? 'line-through text-foreground-secondary' : 'text-foreground',
                        )}
                      >
                        {action.title}
                      </span>
                      <span className="text-nav text-foreground-secondary">{action.detail}</span>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        </Card>
      </section>

      {/* Everyday habits behind this (empathetic framing) */}
      <section className="flex flex-col gap-md">
        <div className="flex flex-col gap-2xs">
          <h2 className="text-h1 font-semibold text-foreground">Why this happens</h2>
          <p className="text-body text-foreground-secondary">
            Nothing to worry about — these everyday habits are very common and easy to adjust:
          </p>
        </div>
        <Card>
          <ol className="flex flex-col divide-y divide-border">
            {likelyCauses.map((cause, i) => (
              <li key={cause} className="flex items-center gap-md py-sm first:pt-0 last:pb-0">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-2 bg-primary/10 text-body font-semibold text-primary"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <span className="text-body text-foreground">{cause}</span>
              </li>
            ))}
          </ol>
        </Card>
      </section>

      {/* Warm dentist care note */}
      <div className="flex items-start gap-sm rounded-4 border border-primary/25 bg-primary/5 p-md">
        <span
          className="grid size-7 shrink-0 place-items-center rounded-full bg-primary/15 text-primary"
          aria-hidden="true"
        >
          <svg viewBox="0 0 24 24" fill="none" className="size-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
          </svg>
        </span>
        <div className="flex flex-col gap-2xs">
          <span className="text-body font-semibold text-foreground">
            Here whenever you need extra care
          </span>
          <p className="text-body text-foreground-secondary">{caution}</p>
        </div>
      </div>

      <RescanReminderButton label={aiInsightDetail.ctaLabel} />
    </>
  )
}
