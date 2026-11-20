'use client'

import { SectionHeader } from './SectionHeader'
import { HealthMetricCard } from './HealthMetricCard'
import { healthMetrics } from '@/features/dashboard/mockDashboard'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useGetComparisonQuery, useGetAnalysisQuery } from '@/features/scan/analysisApi'

/**
 * "Your mouth at a glance" — a 2-column grid of all 6 tracked oral health areas.
 *
 * Reads the signed-in user's real latest scan analysis (`analysis.glance`) when
 * available, falling back to `healthMetrics` (6 tracked areas) when signed out
 * or before the first scan completes.
 */
export function GlanceSection() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: comparison } = useGetComparisonQuery(undefined, { skip: !isAuthenticated })
  const latestScanId = comparison?.to.scanId
  const { data: analysis } = useGetAnalysisQuery(latestScanId ?? '', { skip: !latestScanId })

  const metrics =
    isAuthenticated && analysis?.status === 'ready' && analysis.glance.length > 0
      ? analysis.glance
      : healthMetrics

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Your mouth at a glance" meta={`${metrics.length} areas tracked`} />
      <ul className="grid grid-cols-2 gap-md">
        {metrics.map((metric) => (
          <li key={metric.id}>
            <HealthMetricCard metric={metric} />
          </li>
        ))}
      </ul>
    </section>
  )
}
