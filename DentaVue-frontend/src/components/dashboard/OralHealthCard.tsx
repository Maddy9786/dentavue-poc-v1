'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { StartScanButton } from '@/components/scan/StartScanButton'
import { ReminderModal } from '@/components/reminders/ReminderModal'
import { ScoreGauge } from './ScoreGauge'
import { useOralHealthIndex } from '@/features/dashboard/useOralHealthIndex'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/cn'
import InfoIcon from '@/icons/info.svg'

/**
 * The flagship Hero Card: Oral Health Index gauge, Photo Clarity & Confidence,
 * interactive score explainer, 3 summary tiles, and quick actions (Scan Now,
 * PDF Report, Set Reminder).
 */
export function OralHealthCard() {
  const router = useRouter()
  const { data, isReal } = useOralHealthIndex()
  const { score, max, condition, pointsFromLastScan, confidence, lastScan, nextScan, stats } = data
  const [infoOpen, setInfoOpen] = useState(false)
  const [reminderOpen, setReminderOpen] = useState(false)

  const clarityBadge =
    confidence >= 85
      ? 'Excellent'
      : confidence >= 65
        ? 'Good'
        : confidence > 0
          ? 'Provisional'
          : '—'

  return (
    <>
      <Card className="relative flex flex-col gap-lg overflow-hidden border border-border/80 shadow-md">
        {/* Top signature gradient accent bar */}
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-secondary to-emerald-400"
        />

        <div className="flex items-center justify-between gap-sm pt-2xs">
          <div className="flex items-center gap-xs">
            <button
              type="button"
              onClick={() => setInfoOpen(true)}
              aria-label="How Oral Health Index is calculated"
              className="grid size-7 place-items-center rounded-full text-foreground-secondary transition-colors hover:bg-border/60 hover:text-foreground focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <InfoIcon aria-hidden="true" className="size-5" />
            </button>
            <h2 className="text-h1 font-semibold text-foreground">Oral Health Index</h2>
          </div>

          <Badge tone="secondary" className="rounded-3 px-md py-sm text-surface shadow-2xs">
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
            <div className="flex flex-col gap-2xs">
              <div className="flex items-center justify-between gap-xs">
                <span className="text-h2 font-medium text-foreground">
                  Photo clarity &amp; confidence
                </span>
                {confidence > 0 && (
                  <span className="rounded-full bg-emerald-100 px-xs py-2xs text-[11px] font-semibold text-emerald-800">
                    {clarityBadge}
                  </span>
                )}
              </div>
              <span className="text-nav text-foreground-secondary">
                How clearly your 4 photos showed your mouth
              </span>
              <div className="flex items-center gap-sm pt-2xs">
                <div
                  role="progressbar"
                  aria-valuenow={confidence}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-label="Photo clarity and confidence score"
                  className="h-2.5 flex-1 overflow-hidden rounded-full bg-border"
                >
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-secondary to-success transition-all duration-500"
                    style={{ width: `${confidence}%` }}
                  />
                </div>
                <span className="text-h2 font-bold tabular-nums text-foreground">{confidence}%</span>
              </div>
            </div>

            <dl className="flex items-start justify-between gap-md rounded-3 border border-border/70 bg-background/60 px-md py-sm">
              <div className="flex flex-col">
                <dt className="text-nav text-foreground-secondary">Last Scan</dt>
                <dd className="text-body font-semibold text-foreground">{lastScan}</dd>
              </div>
              <div className="flex flex-col items-end text-right">
                <dt className="text-nav text-foreground-secondary">Next Scan</dt>
                <dd className="text-body font-semibold text-primary">{nextScan}</dd>
              </div>
            </dl>
          </div>
        </div>

        {/* 3 Summary Stat Tiles */}
        <div className="grid grid-cols-3 gap-sm border-t border-border pt-md">
          {stats.map((stat, i) => (
            <div
              key={stat.label}
              className={cn(
                'flex flex-col gap-2xs rounded-3 border border-border/70 bg-background/60 px-sm py-sm',
                i === 1 && stat.value.startsWith('0') && 'border-emerald-200/80 bg-emerald-50/40',
              )}
            >
              <span className="text-nav text-foreground-secondary">{stat.label}</span>
              <span className="text-h1 font-bold text-primary">{stat.value}</span>
              <span className="text-[11px] text-foreground-secondary">{stat.note}</span>
            </div>
          ))}
        </div>

        {/* Primary CTA + Quick Action Bar */}
        <div className="flex flex-col gap-sm">
          <StartScanButton label="Scan Now" variant="secondary" />

          {isReal && (
            <div className="grid grid-cols-2 gap-sm">
              <button
                type="button"
                onClick={() => router.push(ROUTES.patient.scanReport)}
                className="flex items-center justify-center gap-xs rounded-3 border border-border bg-background/80 px-sm py-sm text-nav font-semibold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/5"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4 text-primary" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
                PDF Report
              </button>

              <button
                type="button"
                onClick={() => setReminderOpen(true)}
                className="flex items-center justify-center gap-xs rounded-3 border border-border bg-background/80 px-sm py-sm text-nav font-semibold text-foreground transition-colors hover:border-secondary/50 hover:bg-secondary/5"
              >
                <svg viewBox="0 0 24 24" fill="none" className="size-4 text-secondary" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
                Set Reminder
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* Oral Health Index Info Modal */}
      <Modal
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        title="About your Oral Health Index"
      >
        <div className="flex flex-col gap-md">
          <p className="text-body text-foreground-secondary">
            Your 0–100 score combines all <strong>6 tracked mouth areas</strong> from your 4
            guided photos:
          </p>
          <ul className="flex flex-col gap-xs rounded-3 border border-border bg-background p-md text-nav text-foreground">
            <li>• <strong>80 – 100:</strong> Good condition (calm gums, clean surfaces)</li>
            <li>• <strong>65 – 79:</strong> Fair condition (a few spots to brush gently)</li>
            <li>• <strong>45 – 64:</strong> Needs care (consider extra daily cleaning)</li>
          </ul>
          <p className="text-nav text-foreground-secondary">
            <strong>Photo clarity &amp; confidence</strong> shows how well-lit and sharp your 4
            photos were — higher clarity means a more reliable check.
          </p>
          <Button variant="primary" className="text-surface" onClick={() => setInfoOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>

      <ReminderModal open={reminderOpen} onClose={() => setReminderOpen(false)} />
    </>
  )
}
