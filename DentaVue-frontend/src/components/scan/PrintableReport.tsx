'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { BackButton } from '@/components/ui/BackButton'
import { ROUTES } from '@/constants/routes'
import { cn } from '@/lib/cn'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import { useGetScansQuery } from '@/features/scan/scansApi'
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/store/hooks'
import { scanResults } from '@/features/dashboard/mockDashboard'
import DentaVueLogo from '@/icons/teeth-ai.svg'

function conditionFor(score: number): string {
  if (score >= 80) return 'Good condition'
  if (score >= 60) return 'Fair condition'
  return 'Needs attention'
}

function formatReportDate(iso?: string): string {
  if (!iso) return `${scanResults.date} · ${scanResults.time}`
  const parsed = new Date(iso)
  if (Number.isNaN(parsed.getTime())) return `${scanResults.date} · ${scanResults.time}`
  const date = parsed.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  const time = parsed.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
  })
  return `${date} · ${time} UTC`
}

export function PrintableReport() {
  const router = useRouter()
  const { analysis } = useScanAnalysis()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const currentUser = useAppSelector(selectCurrentUser)
  const { data: scans } = useGetScansQuery(undefined, { skip: !isAuthenticated })
  const [copied, setCopied] = useState(false)

  const scan = analysis ? scans?.find((entry) => entry.id === analysis.scanId) : undefined
  const reportDate = formatReportDate(scan?.capturedAt)
  const reportId = analysis?.scanId ? `DV-${analysis.scanId.slice(0, 8).toUpperCase()}` : 'DV-PREVIEW'

  const patientName =
    currentUser?.firstName || currentUser?.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : 'DentaVue Member'

  const score = analysis?.score ?? scanResults.score
  const condition = analysis ? conditionFor(score) : scanResults.condition
  const confidence = analysis?.confidence ?? scanResults.confidence
  const glance = analysis?.glance.length ? analysis.glance : scanResults.glance
  const findings = analysis?.narrative?.findings.length
    ? analysis.narrative.findings
    : scanResults.findings
  const actions = analysis?.narrative?.actions.length
    ? analysis.narrative.actions
    : scanResults.actions
  const summary =
    analysis?.narrative?.insight?.summary ??
    'All 6 mouth areas were reviewed across your 4-angle guided scan. Continue gentle daily brushing and cleaning between teeth.'

  const handlePrintPdf = () => {
    if (typeof window !== 'undefined') {
      window.print()
    }
  }

  const handleShare = async () => {
    const textSummary = [
      `DentaVue Oral Wellness Report (${reportId})`,
      `Date: ${reportDate}`,
      `Oral Health Index: ${score}/100 (${condition})`,
      `Photo Clarity: ${confidence}%`,
      '',
      '6 Tracked Areas:',
      ...glance.map((g) => `- ${g.title}: ${g.status} — ${g.description}`),
      '',
      `Summary: ${summary}`,
    ].join('\n')

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `DentaVue Report · ${score}/100`,
          text: textSummary,
        })
        return
      } catch {
        // User cancelled or share unsupported — fall back to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textSummary).catch(() => undefined)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    }
  }

  return (
    <main className="min-h-dvh bg-background py-xl print:bg-white print:py-0">
      <div className="mx-auto flex w-full max-w-[680px] flex-col gap-lg px-lg print:max-w-none print:px-0">
        {/* Top Action Bar (hidden when printing / saving PDF) */}
        <header className="flex items-center justify-between gap-sm print:hidden">
          <BackButton fallbackHref={ROUTES.patient.scanResults} />
          <div className="flex items-center gap-xs">
            <Button variant="surface" onClick={handleShare}>
              {copied ? '✓ Copied!' : 'Share Summary'}
            </Button>
            <Button variant="primary" className="text-surface" onClick={handlePrintPdf}>
              Save PDF / Print
            </Button>
          </div>
        </header>

        {/* Branded 1-Page Clinical-Style Report Sheet */}
        <article className="flex flex-col gap-lg rounded-4 border border-border bg-surface p-xl shadow-drop print:rounded-none print:border-0 print:p-6 print:shadow-none">
          {/* Report Header */}
          <div className="flex flex-wrap items-center justify-between gap-md border-b border-border pb-md">
            <div className="flex items-center gap-sm">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-secondary/35 bg-surface">
                <DentaVueLogo aria-hidden="true" className="size-7" />
              </div>
              <div className="flex flex-col">
                <span className="text-h1 font-bold tracking-tight text-foreground">DentaVue</span>
                <span className="text-nav text-foreground-secondary">
                  Oral Wellness Summary Report
                </span>
              </div>
            </div>

            <div className="flex flex-col items-end text-right text-nav text-foreground-secondary">
              <span className="font-semibold text-foreground">{patientName}</span>
              <span>{reportDate}</span>
              <span className="font-mono text-[11px]">ID: {reportId}</span>
            </div>
          </div>

          {/* Score + Photo Clarity Banner */}
          <div className="grid grid-cols-1 gap-md rounded-3 border border-border bg-background/60 p-md sm:grid-cols-3">
            <div className="flex flex-col justify-center">
              <span className="text-nav text-foreground-secondary">Oral Health Index</span>
              <div className="flex items-baseline gap-2xs">
                <span className="text-h1-xl font-bold text-primary">{score}</span>
                <span className="text-body text-foreground-secondary">/ 100</span>
              </div>
            </div>

            <div className="flex flex-col justify-center gap-2xs">
              <span className="text-nav text-foreground-secondary">Overall Status</span>
              <Badge tone="secondary" className="w-fit text-surface">
                {condition}
              </Badge>
            </div>

            <div className="flex flex-col justify-center">
              <span className="text-nav text-foreground-secondary">Photo Clarity & Confidence</span>
              <span className="text-h1 font-semibold text-foreground">{confidence}%</span>
            </div>
          </div>

          {/* Executive Summary */}
          <section className="flex flex-col gap-xs">
            <h2 className="text-h2 font-semibold text-foreground">Summary</h2>
            <p className="text-body leading-relaxed text-foreground-secondary">{summary}</p>
          </section>

          {/* 6 Tracked Areas Grid */}
          <section className="flex flex-col gap-sm">
            <div className="flex items-baseline justify-between">
              <h2 className="text-h2 font-semibold text-foreground">
                Area-by-Area Breakdown ({glance.length} areas tracked)
              </h2>
            </div>

            <div className="grid grid-cols-1 gap-sm sm:grid-cols-2">
              {glance.map((area) => {
                const isWatch = area.tone === 'watch' || area.status === 'Watch'
                return (
                  <div
                    key={area.id}
                    className={cn(
                      'flex flex-col gap-2xs rounded-3 border p-sm',
                      isWatch ? 'border-amber-300 bg-amber-50/40' : 'border-border bg-background/40',
                    )}
                  >
                    <div className="flex items-center justify-between gap-xs">
                      <span className="text-body font-semibold text-foreground">{area.title}</span>
                      <span
                        className={cn(
                          'rounded-full px-xs py-2xs text-[11px] font-semibold',
                          isWatch
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800',
                        )}
                      >
                        {area.status}
                      </span>
                    </div>
                    <p className="text-nav text-foreground-secondary">{area.description}</p>
                  </div>
                )
              })}
            </div>
          </section>

          {/* Key Findings & Daily Care Plan */}
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2">
            <section className="flex flex-col gap-xs">
              <h2 className="text-h2 font-semibold text-foreground">Key Observations</h2>
              <ul className="flex flex-col gap-xs">
                {findings.map((f) => (
                  <li key={f.id} className="rounded-3 border border-border p-sm">
                    <p className="text-nav font-semibold text-foreground">{f.title}</p>
                    <p className="text-[11px] text-foreground-secondary">{f.detail}</p>
                  </li>
                ))}
              </ul>
            </section>

            <section className="flex flex-col gap-xs">
              <h2 className="text-h2 font-semibold text-foreground">Recommended Next Steps</h2>
              <ul className="flex flex-col gap-xs">
                {actions.map((a) => (
                  <li key={a.id} className="rounded-3 border border-border p-sm">
                    <p className="text-nav font-semibold text-foreground">{a.title}</p>
                    <p className="text-[11px] text-foreground-secondary">{a.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          </div>

          {/* Disclaimer Footer */}
          <footer className="border-t border-border pt-md text-[11px] text-foreground-secondary">
            DentaVue Oral Wellness Report · Generated from 4-angle guided intraoral photos. This
            report is an everyday oral wellness overview and is not a medical diagnosis. Share with
            your dentist or hygienist for clinical evaluation.
          </footer>
        </article>

        {/* Bottom Done Button (hidden on print) */}
        <div className="flex justify-center pb-lg print:hidden">
          <Button variant="surface" onClick={() => router.push(ROUTES.home)}>
            Back to Home
          </Button>
        </div>
      </div>
    </main>
  )
}
