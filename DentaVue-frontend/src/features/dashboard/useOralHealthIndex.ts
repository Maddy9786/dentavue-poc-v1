import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import {
  useGetComparisonQuery,
  useGetAnalysisQuery,
  type Analysis,
  type Comparison,
} from '@/features/scan/analysisApi'
import { formatScanDate, nextScanBanner } from '@/features/scan/scanDisplay'
import { oralHealthIndex, type OralHealthIndex } from './mockDashboard'

/**
 * The Oral Health Index hero card's data.
 *
 * WHY THIS EXISTS: the card used to read the static `oralHealthIndex` mock, so
 * the gauge showed 82/100 for everyone — it never reflected a signed-in user's
 * actual latest scan. This hook wires it to the real AI result while keeping the
 * mock as the signed-out / no-scans / still-loading fallback, so the marketing
 * home page is unchanged but a logged-in user with a scan sees their own numbers.
 *
 * DATA SOURCES — both are existing backend endpoints, and every number is
 * backend-derived (the model observes, the backend decides; see AI_INTEGRATION):
 *   - GET /scans/comparison  → the latest scan's score, capture date, and the
 *     server-computed diffs vs. the first scan (used for the trend stats). Always
 *     agrees with the Compare screen because it's the same endpoint.
 *   - GET /scans/:id/analysis (latest) → confidence, points-vs-last-scan, and the
 *     tracked-parameter count. Fetched by the scanId the comparison hands back.
 *
 * The ONE derived-on-the-client value is `condition` — a plain-language band of
 * the (backend) score, because the backend exposes no overall status word. It's
 * presentation only; thresholds below are flagged for design sign-off.
 */

/** Score → the badge word shown on the card. Presentation only — see note above. */
function conditionLabel(score: number): string {
  if (score >= 80) return 'Good condition'
  if (score >= 65) return 'Fair condition'
  if (score >= 45) return 'Needs care'
  return 'Poor condition'
}

/**
 * The three summary stats under the gauge: Healthy Areas, Needs Care, and Score Trend.
 */
function buildStats(analysis: Analysis, comparison: Comparison): OralHealthIndex['stats'] {
  const totalAreas = analysis.glance.length || analysis.parameters.length || 6
  const watchAreas = analysis.glance.filter((g) => g.tone === 'watch')
  const healthyCount = totalAreas - watchAreas.length

  const needsCareValue =
    watchAreas.length === 1 ? '1 area' : `${watchAreas.length} areas`
  const needsCareNote =
    watchAreas.length === 0
      ? 'all clear!'
      : watchAreas.length === 1
        ? watchAreas[0]!.title.toLowerCase()
        : 'to keep an eye on'

  const delta = analysis.pointsFromLastScan
  const trendValue =
    delta.direction === 'up' && delta.points > 0
      ? `+${delta.points} pts`
      : delta.direction === 'down' && delta.points > 0
        ? `-${delta.points} pts`
        : 'Steady'
  const trendNote = comparison.single ? 'first check' : 'since last scan'

  return [
    { label: 'Healthy Areas', value: `${healthyCount} of ${totalAreas}`, note: 'looking good' },
    { label: 'Needs Care', value: needsCareValue, note: needsCareNote },
    { label: 'Score Trend', value: trendValue, note: trendNote },
  ]
}

const emptySignedInIndex: OralHealthIndex = {
  score: 0,
  max: 100,
  condition: 'No scan yet',
  pointsFromLastScan: 0,
  confidence: 0,
  lastScan: 'Not scanned yet',
  nextScan: 'Ready today',
  stats: [
    { label: 'Healthy Areas', value: '— of 6', note: 'awaiting scan' },
    { label: 'Needs Care', value: '—', note: 'take first scan' },
    { label: 'Score Trend', value: 'No scan', note: 'start today' },
  ],
}

/**
 * Returns the card's data plus whether it's the real result (`isReal`) or the
 * placeholder.
 *   - Signed out → demo `oralHealthIndex` preview
 *   - Signed in, 0 scans → `emptySignedInIndex` ("No scan yet")
 *   - Signed in, with scan → live `analysis` + `comparison` figures
 */
export function useOralHealthIndex(): { data: OralHealthIndex; isReal: boolean } {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  // The comparison gives us the latest scanId + capture date without a separate
  // /scans call; skipped entirely while signed out so no request fires.
  const { data: comparison, isLoading: isComparisonLoading } = useGetComparisonQuery(undefined, {
    skip: !isAuthenticated,
  })

  // Confidence and points-vs-last-scan live on the latest scan's own analysis.
  const latestScanId = comparison?.to.scanId
  const { data: analysis, isLoading: isAnalysisLoading } = useGetAnalysisQuery(latestScanId ?? '', {
    skip: !latestScanId,
  })

  if (!isAuthenticated) {
    return { data: oralHealthIndex, isReal: false }
  }

  // Signed in, and either has 0 scans (comparison === null) or analysis isn't ready yet
  if (
    isComparisonLoading ||
    isAnalysisLoading ||
    !comparison ||
    !analysis ||
    analysis.status !== 'ready' ||
    analysis.score == null
  ) {
    return { data: emptySignedInIndex, isReal: false }
  }

  const capturedAt = comparison.to.capturedAt
  const nextBanner = nextScanBanner(capturedAt)

  const signedPoints =
    analysis.pointsFromLastScan.direction === 'down'
      ? -analysis.pointsFromLastScan.points
      : analysis.pointsFromLastScan.direction === 'up'
        ? analysis.pointsFromLastScan.points
        : 0

  const data: OralHealthIndex = {
    score: analysis.score,
    max: 100,
    condition: conditionLabel(analysis.score),
    pointsFromLastScan: signedPoints,
    confidence: analysis.confidence ?? 0,
    // Absolute capture date ("Apr 8") rather than a relative "2 days ago": a
    // relative label needs `Date.now()` in render, which risks a hydration
    // mismatch and breaks the render-purity rule the codebase holds to.
    lastScan: formatScanDate(capturedAt) || '—',
    nextScan: nextBanner.inLabel,
    nextScanDate: nextBanner.date,
    stats: buildStats(analysis, comparison),
  }

  return { data, isReal: true }
}
