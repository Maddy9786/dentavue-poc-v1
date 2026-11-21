'use client'

import { SectionHeader } from './SectionHeader'
import { HealthMetricCard } from './HealthMetricCard'
import { healthMetrics, type HealthMetric } from '@/features/dashboard/mockDashboard'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useGetComparisonQuery, useGetAnalysisQuery, type ParameterKey } from '@/features/scan/analysisApi'

const GLANCE_TO_PARAM: Record<string, ParameterKey> = {
  'gum-health': 'gumInflammation',
  enamel: 'enamelWear',
  'oral-tissue': 'tissueAppearance',
  'plaque-risk': 'plaqueExtent',
  'gum-line': 'gumMarginRecession',
  'tartar-stain': 'calculusStain',
}

const emptySignedInMetrics: HealthMetric[] = [
  {
    id: 'gum-lower',
    title: 'Gum Health',
    description: 'Take your first scan to check your gum comfort and colour.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
  {
    id: 'enamel',
    title: 'Tooth Strength',
    description: 'Take your first scan to check your tooth surfaces and edges.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
  {
    id: 'oral-tissue',
    title: 'Tongue & Cheeks',
    description: 'Take your first scan to check your tongue and inner cheeks.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
  {
    id: 'plaque-risk',
    title: 'Tooth Cleanliness',
    description: 'Take your first scan to check for everyday soft buildup.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
  {
    id: 'gum-line',
    title: 'Gum Line',
    description: 'Take your first scan to check how evenly your gums sit.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
  {
    id: 'tartar-stain',
    title: 'Stains & Tartar',
    description: 'Take your first scan to check for surface stain or tartar.',
    status: 'Not scanned',
    tone: 'positive',
    trend: '—',
  },
]

/**
 * "Your mouth at a glance" — a 2-column grid of all 6 tracked oral health areas.
 *
 *   - Signed out → demo `healthMetrics` preview
 *   - Signed in, no scan yet → `emptySignedInMetrics` ("Not scanned")
 *   - Signed in, with scan → live `analysis.glance`
 */
export function GlanceSection() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: comparison } = useGetComparisonQuery(undefined, { skip: !isAuthenticated })
  const latestScanId = comparison?.to.scanId
  const { data: analysis } = useGetAnalysisQuery(latestScanId ?? '', { skip: !latestScanId })

  const metrics = !isAuthenticated
    ? healthMetrics
    : analysis?.status === 'ready' && analysis.glance.length > 0
      ? analysis.glance
      : emptySignedInMetrics

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Your mouth at a glance" meta={`${metrics.length} areas tracked`} />
      <ul className="grid grid-cols-2 gap-md">
        {metrics.map((metric) => {
          const paramKey = GLANCE_TO_PARAM[metric.id]
          const severity =
            isAuthenticated && analysis?.status === 'ready' && paramKey
              ? analysis.parameters.find((p) => p.parameter === paramKey)?.severity
              : undefined
          return (
            <li key={metric.id}>
              <HealthMetricCard metric={metric} severity={severity} />
            </li>
          )
        })}
      </ul>
    </section>
  )
}
