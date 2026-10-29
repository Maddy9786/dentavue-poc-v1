'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { cn } from '@/lib/cn'
import { Card } from '@/components/ui/Card'
import { CheckCircleGlyph } from '@/components/ui/StatusGlyphs'
import { ROUTES } from '@/constants/routes'
import { analysingScan } from '@/features/dashboard/mockDashboard'
import { useGetAnalysisQuery } from '@/features/scan/analysisApi'
import { selectScanDraftId } from '@/features/scan/scanDraftSlice'
import { useAppSelector } from '@/store/hooks'
import TeethAnalyseScanIcon from '@/icons/teeth-analyse-scan.svg'
import LoaderIcon from '@/icons/loader.svg'

// The progress bar's own pace. Real analysis takes a few seconds and reports no
// intermediate percentage, so the bar advances on a timer and is then SNAPPED to
// 100 the moment the result lands — honest about the outcome, smooth in between.
const TICK_MS = 120
const STEP = 2
// Where the timer parks while waiting. Never reaches 100 on its own: a bar that
// sits at 100% while still working reads as a hang.
const WAITING_CEILING = 90
const SETTLE_MS = 600

// How often to ask the backend whether the analysis is done.
const POLL_MS = 1500
// Give up waiting after this and move on with whatever exists. The results
// screens degrade to placeholder copy, which is far better than trapping
// someone on a spinner because a model call is wedged.
const MAX_WAIT_MS = 45_000

/**
 * "Analysing your scan" — the progress screen between Analyse and the results.
 *
 * Backed by the real AI pipeline: POST /scans returns as soon as the images are
 * stored, analysis runs server-side, and this screen polls
 * GET /scans/:scanId/analysis until it reports `ready` or `failed`.
 *
 * It degrades on every axis, because none of the failure modes should strand a
 * user mid-flow:
 *   - signed out, or the upload failed  → no scanId, so it runs on the timer
 *   - analysis not configured / errored → `failed`, and it moves on
 *   - analysis is slow                  → the bar parks at 90% and waits
 *   - analysis is stuck                 → MAX_WAIT_MS gives up and moves on
 * In every case the user reaches the results screen; only the richness of what
 * is there changes.
 *
 * Accessibility: the percentage is a real `role="progressbar"` (min/now/max +
 * aria-valuetext), so assistive tech follows the progress rather than reading a
 * bare number; the steps are a list, each glyph decorative beside its label. The
 * spinner honours `prefers-reduced-motion`. Uses router.replace so Back from the
 * results screens doesn't return to this transient one.
 */
export function AnalysingScan() {
  const router = useRouter()
  const { title, description, steps } = analysingScan
  const scanId = useAppSelector(selectScanDraftId)

  const [progress, setProgress] = useState(0)
  const [gaveUp, setGaveUp] = useState(false)

  const { data: analysis } = useGetAnalysisQuery(scanId ?? '', {
    skip: !scanId || gaveUp,
    // Stops as soon as the effect below sees a terminal status, because the
    // query is unmounted by the navigation that follows.
    pollingInterval: POLL_MS,
  })

  // Terminal either way: a failed analysis still lets the user through to the
  // results screen, which renders its placeholder copy.
  const settled = analysis?.status === 'ready' || analysis?.status === 'failed'
  // With no scan to poll (signed out, or the upload failed) the timer alone
  // drives the screen, exactly as it did before the AI layer existed.
  const simulated = !scanId || gaveUp

  // Advance the bar. It runs to 100 when there is nothing to wait for, and parks
  // at WAITING_CEILING while a real analysis is still in flight.
  useEffect(() => {
    const ceiling = simulated || settled ? 100 : WAITING_CEILING
    const id = setInterval(() => {
      setProgress((p) => Math.min(ceiling, p + STEP))
    }, TICK_MS)
    return () => clearInterval(id)
  }, [simulated, settled])

  // The backstop. A wedged model call must not hold someone here indefinitely.
  useEffect(() => {
    if (simulated || settled) return
    const timer = setTimeout(() => setGaveUp(true), MAX_WAIT_MS)
    return () => clearTimeout(timer)
  }, [simulated, settled])

  // Move on once the bar is full. The ref stops a re-render (from a poll landing
  // in the same tick) queueing a second navigation.
  const navigatedRef = useRef(false)
  useEffect(() => {
    if (progress < 100 || navigatedRef.current) return
    navigatedRef.current = true
    const timer = setTimeout(() => router.replace(ROUTES.patient.riskAssessment), SETTLE_MS)
    return () => clearTimeout(timer)
  }, [progress, router])

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full app-column flex-1 flex-col items-center justify-center gap-3xl px-lg py-2xl">
        {/* Illustration + progress copy. */}
        <div className="flex flex-col items-center gap-2xl text-center">
          {/* Self-contained illustration: beige disc + teal tooth. */}
          <TeethAnalyseScanIcon aria-hidden="true" className="size-40" />

          <div className="flex flex-col items-center gap-sm">
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-valuetext={`${progress}% — ${title}`}
              aria-label={title}
              className="text-h1-xl font-semibold text-primary"
            >
              {progress}%
            </div>
            <h1 className="text-h1 font-semibold text-foreground">{title}</h1>
            <p className="max-w-[260px] text-body text-foreground-secondary">{description}</p>
          </div>
        </div>

        {/* Step checklist. Done steps show a check; the active one spins. */}
        <Card className="w-full">
          <ul className="flex flex-col gap-sm">
            {steps.map((step) => {
              const done = progress >= step.doneAt
              return (
                <li key={step.id} className="flex items-center gap-sm">
                  <span
                    className={cn('shrink-0', done ? 'text-foreground' : 'text-foreground-secondary')}
                    aria-hidden="true"
                  >
                    {done ? (
                      <CheckCircleGlyph />
                    ) : (
                      <LoaderIcon className="size-5 animate-spin motion-reduce:animate-none" />
                    )}
                  </span>
                  <span
                    className={cn(
                      'text-h2',
                      done ? 'font-medium text-foreground' : 'text-foreground-secondary',
                    )}
                  >
                    {step.label}
                  </span>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>
    </main>
  )
}
