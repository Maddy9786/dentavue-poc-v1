'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { SectionHeader } from './SectionHeader'
import { aiInsight } from '@/features/dashboard/mockDashboard'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useGetComparisonQuery, useGetAnalysisQuery } from '@/features/scan/analysisApi'
import { formatScanDate } from '@/features/scan/scanDisplay'
import { ROUTES } from '@/constants/routes'
import GenerativeAiIcon from '@/icons/generative-ai.svg'
import ArrowRightIcon from '@/icons/arrow-right.svg'

/**
 * "Latest Findings" — the Personal Care Insight card on Home.
 *
 * When signed in with a completed scan, displays the user's real everyday care
 * summary (`analysis.narrative.insight.summary`). Otherwise falls back to the
 * friendly sample summary.
 */
export function LatestFindings() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const router = useRouter()
  const [signInToast, setSignInToast] = useState(false)

  const { data: comparison } = useGetComparisonQuery(undefined, { skip: !isAuthenticated })
  const latestScanId = comparison?.to.scanId
  const { data: analysis } = useGetAnalysisQuery(latestScanId ?? '', { skip: !latestScanId })

  const realInsight =
    isAuthenticated && analysis?.status === 'ready' ? analysis.narrative?.insight : null
  const summaryText = realInsight?.summary ?? aiInsight.body
  const cardTitle = realInsight?.title ?? 'Personal Care Insight'
  const updatedText =
    isAuthenticated && comparison?.to.capturedAt
      ? formatScanDate(comparison.to.capturedAt)
      : aiInsight.updated

  // Auto-dismiss the toast after 2s; the cleanup covers an unmount mid-timer.
  useEffect(() => {
    if (!signInToast) return
    const timer = setTimeout(() => setSignInToast(false), 2000)
    return () => clearTimeout(timer)
  }, [signInToast])

  const handleFullAnalysis = () => {
    if (isAuthenticated) {
      router.push(ROUTES.patient.aiInsight)
    } else {
      setSignInToast(true)
    }
  }

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Latest Findings" />

      <Card className="flex flex-col gap-md">
        <div className="flex items-center gap-sm">
          {/* generative-ai.svg is a self-contained chip (own box + glyph). */}
          <GenerativeAiIcon aria-hidden="true" className="size-9 shrink-0" />
          <div className="flex flex-col">
            <h3 className="text-h2 font-semibold text-foreground">{cardTitle}</h3>
            <span className="text-nav text-foreground-secondary">Updated {updatedText}</span>
          </div>
        </div>

        <p className="text-body text-foreground-secondary">{summaryText}</p>

        <button
          type="button"
          onClick={handleFullAnalysis}
          className="inline-flex items-center gap-xs self-start rounded-1 text-h2 font-medium text-foreground focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          See full care guide
          <ArrowRightIcon aria-hidden="true" className="size-4 text-foreground" />
        </button>
      </Card>

      {/* Sign-in nudge — a transient, non-blocking toast, above the bottom nav. */}
      {signInToast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-x-0 bottom-28 z-50 flex justify-center px-lg"
        >
          <span className="rounded-full bg-foreground px-lg py-sm text-h2 font-medium text-surface shadow-elevated">
            Please sign in first to view your full care guide.
          </span>
        </div>
      )}
    </section>
  )
}
