'use client'

import type { ComponentType, SVGProps } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { ScoreGauge } from '@/components/dashboard/ScoreGauge'
import { StatusIndicator } from '@/components/dashboard/StatusIndicator'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { CheckCircleGlyph, AlertCircleGlyph, AlertTriangleGlyph } from '@/components/ui/StatusGlyphs'
import { AnnotatedScanCarousel } from '@/components/scan/AnnotatedScanCarousel'
import { ComingSoonButton } from '@/components/scan/ComingSoonButton'
import { ScanUnclearNotice } from '@/components/scan/ScanUnclearNotice'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import { useGetScansQuery } from '@/features/scan/scansApi'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/store/hooks'
import { ROUTES } from '@/constants/routes'
import { scanResults, type GlanceIcon, type ScanResultAction } from '@/features/dashboard/mockDashboard'
import GumIcon from '@/icons/gum.svg'
import EnamelIcon from '@/icons/enamel.svg'
import TissueIcon from '@/icons/tissue.svg'
import PlaqueIcon from '@/icons/plaque.svg'
import FlossIcon from '@/icons/floss.svg'
import RescanIcon from '@/icons/rescan.svg'

// Glance glyphs are bare (no chip box), so they render inside a bg-border chip.
const GLANCE_ICONS: Record<GlanceIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  gum: GumIcon,
  enamel: EnamelIcon,
  tissue: TissueIcon,
  plaque: PlaqueIcon,
}

// Action glyphs are self-contained chips (own #ECE7DF box), rendered directly.
const ACTION_ICONS: Record<ScanResultAction['icon'], ComponentType<SVGProps<SVGSVGElement>>> = {
  floss: FlossIcon,
  rescan: RescanIcon,
}

const COMING_SOON = 'This is coming soon — the booking and reminder flows are still being built.'

/** Score band → the words beside the gauge. Derived, never model output. */
function conditionFor(score: number): string {
  if (score >= 80) return 'Good condition'
  if (score >= 60) return 'Fair condition'
  return 'Needs attention'
}

/**
 * Formats a capture timestamp for the header.
 *
 * PINNED TO UTC deliberately. This component renders on the server and hydrates
 * on the client; a locale-local format would produce a different string in each
 * and trip a hydration mismatch — the same class of bug as calling Date.now()
 * during render.
 */
function formatCapturedAt(iso: string): { date: string; time: string } | null {
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return null
  return {
    date: parsed.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    }),
    time: parsed.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC',
    }),
  }
}

/**
 * The scan-results body — score, annotated scan, at-a-glance, findings, monitor
 * and recommended actions.
 *
 * A client island so it can read the real AI analysis. EVERY field falls back to
 * the placeholder content in `scanResults` when there is no analysis (signed
 * out, no scans, still analysing, or it failed), so the screen is never empty
 * and the signed-out view is unchanged.
 *
 * WHAT COMES FROM WHERE, because it is easy to assume all of this is "the AI":
 *   - score, confidence, delta, glance status/trend → computed by the BACKEND's
 *     scoring.ts from the model's raw severities. Deterministic and reproducible.
 *   - findings, monitor, actions → written by a second, text-only model pass
 *     that is GIVEN those numbers, so the prose cannot contradict them.
 *   - the boxes on the carousel → the model's bounding boxes, unmodified.
 * Nothing here recomputes anything from `analysis.parameters`; the raw
 * severities are audit data, not a UI source.
 */
export function ScanResultsContent() {
  const router = useRouter()
  const { analysis, error } = useScanAnalysis()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: scans } = useGetScansQuery(undefined, { skip: !isAuthenticated })

  // A failed analysis (unreadable photos, or a service error) shows the retake
  // state INSTEAD of the sample results, so an unusable scan never renders as a
  // perfect 100. Only signed-in users have a scan to fail; signed out, `error`
  // is null and the marketing sample view below is unchanged.
  if (error) {
    return <ScanUnclearNotice message={error} />
  }

  const scan = analysis ? scans?.find((entry) => entry.id === analysis.scanId) : undefined
  const captured = scan ? formatCapturedAt(scan.capturedAt) : null

  const date = captured?.date ?? scanResults.date
  const time = captured?.time ?? scanResults.time
  const score = analysis?.score ?? scanResults.score
  const condition = analysis ? conditionFor(score) : scanResults.condition
  const confidence = analysis?.confidence ?? scanResults.confidence

  // A stable delta renders as 0 — the gauge shows no movement rather than
  // dressing up noise as progress.
  const pointsFromLastScan = analysis
    ? analysis.pointsFromLastScan.direction === 'stable'
      ? 0
      : analysis.pointsFromLastScan.points
    : scanResults.pointsFromLastScan

  const glance = analysis?.glance.length ? analysis.glance : scanResults.glance
  const findings = analysis?.narrative?.findings.length
    ? analysis.narrative.findings
    : scanResults.findings
  const actions = analysis?.narrative?.actions.length
    ? analysis.narrative.actions
    : scanResults.actions

  // The monitor card is CONDITIONAL, not defaulted: pass 2 omits it when nothing
  // warrants a closer look, and showing the placeholder warning to someone whose
  // scan was clean would be a small but real harm.
  const monitor = analysis ? analysis.narrative?.monitor : scanResults.monitor

  const confidenceNote = analysis
    ? analysis.provisional
      ? 'Your photos were hard to read, so this result is provisional. Try again in better light.'
      : scanResults.confidenceNote
    : scanResults.confidenceNote

  const findingsMeta = captured ? `From your ${captured.date} scan` : scanResults.findingsMeta

  return (
    <>
      {/* Score + confidence — reuses the Home hero's gauge. */}
      <Card className="flex flex-col gap-lg">
        <div className="flex items-center justify-between gap-sm">
          <div className="flex items-baseline gap-sm">
            <span className="text-h2 font-semibold text-foreground">{date}</span>
            <span className="text-body text-foreground-secondary">{time}</span>
          </div>
          {/* Teal + white per the design (white below AA on the fill; kept per client). */}
          <Badge tone="secondary" className="shrink-0 rounded-3 px-md py-sm text-surface">
            {condition}
          </Badge>
        </div>

        <div className="flex items-center gap-lg">
          <ScoreGauge
            score={score}
            max={scanResults.max}
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
            <p className="text-body text-foreground-secondary">{confidenceNote}</p>
          </div>
        </div>
      </Card>

      {/* Annotated scan — the real uploaded images, with the AI's regions drawn. */}
      <AnnotatedScanCarousel />

      {/* Your mouth at a glance. */}
      <section className="flex flex-col gap-md">
        <SectionHeader title="Your mouth at a glance" meta={`${glance.length} areas`} />
        <ul className="grid grid-cols-2 gap-md">
          {glance.map((item) => {
            const Icon = GLANCE_ICONS[item.icon]
            return (
              <li key={item.id}>
                <Card className="flex h-full flex-col gap-sm p-md">
                  <span
                    className="grid size-9 shrink-0 place-items-center rounded-2 bg-border text-foreground"
                    aria-hidden="true"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col gap-2xs">
                    <h3 className="text-h2 font-semibold text-foreground">{item.title}</h3>
                    <p className="text-body text-foreground-secondary">{item.description}</p>
                  </div>
                  <div className="mt-auto flex items-center justify-between gap-sm pt-xs">
                    <StatusIndicator tone={item.tone} label={item.status} />
                    {/* Teal + white per the design (below AA on the fill; kept per client). */}
                    <Badge tone="secondary" className="text-surface">
                      {item.trend}
                    </Badge>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Key findings. */}
      <section className="flex flex-col gap-md">
        <SectionHeader title="Key findings" meta={findingsMeta} />
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {findings.map((finding) => (
              <li key={finding.id} className="flex items-start gap-md py-sm first:pt-0 last:pb-0">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-2 bg-border text-foreground"
                  aria-hidden="true"
                >
                  {finding.status === 'good' ? <CheckCircleGlyph /> : <AlertCircleGlyph />}
                </span>
                <div className="flex flex-col">
                  <span className="text-body font-semibold text-foreground">{finding.title}</span>
                  <span className="text-nav text-foreground-secondary">{finding.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Monitor — the one area needing a closer look. Absent when nothing does. */}
      {monitor && (
        <Card className="flex flex-col gap-md">
          <span className="inline-flex w-fit items-center gap-xs rounded-full bg-secondary px-md py-sm text-nav font-semibold text-surface">
            <AlertTriangleGlyph />
            {monitor.badge}
          </span>
          <div className="flex flex-col gap-xs">
            {/* Teal heading per the design (below AA on white; kept per client). */}
            <h2 className="text-h1 font-semibold text-secondary">{monitor.title}</h2>
            <p className="text-body text-foreground-secondary">{monitor.body}</p>
          </div>
          {/* Recommended inset — Stroke fill (#ECE7DF = --color-border) per design. */}
          <div className="flex items-start gap-sm rounded-3 bg-border p-md">
            <span className="shrink-0 text-foreground" aria-hidden="true">
              <CheckCircleGlyph />
            </span>
            <p className="text-body text-foreground-secondary">
              <span className="font-semibold text-foreground">Recommended:</span> {monitor.recommended}
            </p>
          </div>
          <div className="flex gap-sm">
            <ComingSoonButton label="Book a specialist" message={COMING_SOON} variant="secondary" whiteLabel />
            {/* Stroke fill (#ECE7DF = --color-border) per design. */}
            <ComingSoonButton
              label="Remind me"
              message={COMING_SOON}
              variant="surface"
              className="bg-border text-foreground-secondary shadow-none"
            />
          </div>
        </Card>
      )}

      {/* Recommended actions. */}
      <section className="flex flex-col gap-md">
        <SectionHeader title="Recommended actions" />
        <ul className="grid grid-cols-2 gap-md">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.icon]
            return (
              <li key={action.id}>
                <Card className="flex h-full flex-col gap-sm p-md">
                  <Icon aria-hidden="true" className="size-9" />
                  <div className="flex flex-col gap-2xs">
                    <h3 className="text-h2 font-semibold text-foreground">{action.title}</h3>
                    <p className="text-body text-foreground-secondary">{action.detail}</p>
                  </div>
                </Card>
              </li>
            )
          })}
        </ul>
      </section>

      {/* Bottom actions. */}
      <div className="flex flex-col gap-sm pt-lg">
        <ComingSoonButton label="Book a specialist" message={COMING_SOON} variant="primary" whiteLabel />
        {/* Report generation isn't built; for now this ends the guided-scan flow
            back at Home. `push`, not `replace` — the results screen stays in
            history so Back returns here. Same Stroke-fill style as "Remind me". */}
        <Button
          variant="surface"
          className="bg-border text-foreground-secondary shadow-none"
          onClick={() => router.push(ROUTES.home)}
        >
          Generate Report
        </Button>
      </div>
    </>
  )
}
