'use client'

import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { CheckGlyph, AlertCircleGlyph, AlertTriangleGlyph } from '@/components/ui/StatusGlyphs'
import { ScanShowcase } from '@/components/scan/ScanShowcase'
import { ScanUnclearNotice } from '@/components/scan/ScanUnclearNotice'
import { RescanReminderButton } from '@/components/insight/RescanReminderButton'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import { aiInsightDetail, type InsightAction } from '@/features/dashboard/mockDashboard'
import AiInsightIcon from '@/icons/ai-insight.svg'

/**
 * The AI-insight body — summary, likely causes, what to do, caution.
 *
 * A client island so it can read the real analysis, falling back to the
 * placeholder write-up when there isn't one (signed out, no scans, still
 * analysing, or the prose pass failed). The page stays a server shell.
 *
 * `narrative.insight` comes from the SECOND, text-only model pass, which is
 * given the already-computed bands and score. That is why nothing here needs to
 * cross-check a number against the prose: pass 2 is told the numbers and is
 * instructed not to restate them, so the two cannot disagree.
 *
 * `confidence` is the one figure shown alongside, and it is computed by the
 * backend — not asked of the model.
 */
export function AiInsightContent() {
  const { analysis, error } = useScanAnalysis()

  // Unreadable/failed scan → the retake state, not a sample write-up (see
  // ScanResultsContent for the same guard). Signed out, `error` is null.
  if (error) {
    return <ScanUnclearNotice message={error} />
  }

  const written = analysis?.narrative?.insight ?? null

  const title = written?.title ?? aiInsightDetail.title
  const status = written?.status ?? aiInsightDetail.status
  const summary = written?.summary ?? aiInsightDetail.summary
  const likelyCauses = written?.likelyCauses.length
    ? written.likelyCauses
    : aiInsightDetail.likelyCauses
  const caution = written?.caution ?? aiInsightDetail.caution
  const confidence = analysis?.confidence ?? aiInsightDetail.confidence

  /**
   * "What to do" reuses pass 2's `actions` when there is a real analysis. Those
   * carry no done/todo flag — the model is not asked for one, because whether a
   * user has actually done something is app state, not an observation. The
   * re-scan action is the only one that is inherently upcoming, so it is the
   * only one marked as such.
   */
  const whatToDo: InsightAction[] = analysis?.narrative?.actions.length
    ? analysis.narrative.actions.map((action) => ({
        id: action.id,
        title: action.title,
        detail: action.detail,
        done: action.icon !== 'rescan',
      }))
    : aiInsightDetail.whatToDo

  return (
    <>
      {/* Summary card */}
      <Card className="flex flex-col gap-md">
        <div className="flex items-start gap-sm">
          {/* ai-insight.svg is a self-contained chip (own box + glyph). */}
          <AiInsightIcon aria-hidden="true" className="size-9 shrink-0" />
          <div className="flex min-w-0 flex-1 flex-col">
            <h2 className="text-h2 font-semibold text-foreground">{title}</h2>
            <span className="text-nav text-foreground-secondary">
              Updated {aiInsightDetail.updated} · Confidence {confidence}%
            </span>
          </div>
          {/* Teal + white 'Watch' pill, matching the home card's status
              treatment (the design draws these fills with white text). */}
          <Badge tone="secondary" className="shrink-0 text-surface">
            {status}
          </Badge>
        </div>
        <p className="text-body text-foreground-secondary">{summary}</p>
      </Card>

      {/* What the scan shows — the user's real scans (demo when signed out, the
          blank placeholder when signed in with none), same source as home's
          Compare Progress and /compare. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h1 font-semibold text-foreground">What the scan shows</h2>
        <ScanShowcase />
      </section>

      {/* Likely causes — numbered list on one card. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h1 font-semibold text-foreground">Likely causes</h2>
        <Card>
          <ol className="flex flex-col divide-y divide-border">
            {likelyCauses.map((cause, i) => (
              <li key={cause} className="flex items-center gap-md py-sm first:pt-0 last:pb-0">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-2 bg-border text-body font-semibold text-foreground"
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

      {/* What to do — recommended actions; done steps show a check, the upcoming
          re-scan shows an alert mark. */}
      <section className="flex flex-col gap-md">
        <h2 className="text-h1 font-semibold text-foreground">What to do</h2>
        <Card>
          <ul className="flex flex-col divide-y divide-border">
            {whatToDo.map((action) => (
              <li key={action.id} className="flex items-start gap-md py-sm first:pt-0 last:pb-0">
                <span
                  className="grid size-8 shrink-0 place-items-center rounded-2 bg-border text-foreground"
                  aria-hidden="true"
                >
                  {action.done ? <CheckGlyph /> : <AlertCircleGlyph />}
                </span>
                <div className="flex flex-col">
                  <span className="text-body font-semibold text-foreground">{action.title}</span>
                  <span className="text-nav text-foreground-secondary">{action.detail}</span>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </section>

      {/* Caution — the safety net; muted, never alarming. */}
      <div className="flex items-start gap-sm rounded-4 border border-border bg-surface p-md">
        <span className="shrink-0 text-foreground-secondary" aria-hidden="true">
          <AlertTriangleGlyph />
        </span>
        <p className="text-body text-foreground-secondary">{caution}</p>
      </div>

      <RescanReminderButton label={aiInsightDetail.ctaLabel} />
    </>
  )
}
