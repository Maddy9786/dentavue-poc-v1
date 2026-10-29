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

const signed = (n: number): string => (n > 0 ? `+${n}` : String(n))

/**
 * The three trend stats under the gauge. Sourced from real backend figures only:
 * the overall score delta and improving-area count come from the comparison, the
 * confidence is the latest analysis's. No client-side percentages are invented —
 * the backend deliberately does not expose per-parameter deltas as percentages
 * (severity is audit-only), so we show what it does compute.
 */
function buildStats(analysis: Analysis, comparison: Comparison): OralHealthIndex['stats'] {
  const confidence = analysis.confidence ?? 0

  // Two-plus analysed scans: a real diff exists.
  if (!comparison.single) {
    const improving = comparison.metrics.filter((m) => m.tone === 'improving').length
    return [
      { label: 'Oral Health', value: signed(comparison.overall.points), note: 'since first scan' },
      { label: 'Areas improving', value: String(improving), note: `of ${comparison.metrics.length} tracked` },
      { label: 'Confidence', value: `${confidence}%`, note: 'this scan' },
    ]
  }

  // Only one scan on record — it's the baseline, nothing to diff against yet.
  return [
    { label: 'Oral Health', value: String(analysis.score ?? 0), note: 'your baseline' },
    { label: 'Areas tracked', value: String(analysis.parameters.length), note: 'this scan' },
    { label: 'Confidence', value: `${confidence}%`, note: 'this scan' },
  ]
}

/**
 * Returns the card's data plus whether it's the real result (`isReal`) or the
 * placeholder. All hooks run unconditionally; the fallback is chosen from their
 * results, so hook order is stable.
 */
export function useOralHealthIndex(): { data: OralHealthIndex; isReal: boolean } {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)

  // The comparison gives us the latest scanId + capture date without a separate
  // /scans call; skipped entirely while signed out so no request fires.
  const { data: comparison } = useGetComparisonQuery(undefined, { skip: !isAuthenticated })

  // Confidence and points-vs-last-scan live on the latest scan's own analysis.
  const latestScanId = comparison?.to.scanId
  const { data: analysis } = useGetAnalysisQuery(latestScanId ?? '', { skip: !latestScanId })

  // Fall back to the documented placeholder until a READY analysis for the latest
  // scan exists: signed out, no scans (comparison null), still loading, or the
  // model hasn't finished. The `score == null` guard also narrows the type below.
  if (
    !isAuthenticated ||
    !comparison ||
    !analysis ||
    analysis.status !== 'ready' ||
    analysis.score == null
  ) {
    return { data: oralHealthIndex, isReal: false }
  }

  const capturedAt = comparison.to.capturedAt

  const data: OralHealthIndex = {
    score: analysis.score,
    max: 100,
    condition: conditionLabel(analysis.score),
    // The gauge frames this as an improvement ("+N points"); the deadband bands
    // tiny moves to 0, so a stable scan reads "+0".
    pointsFromLastScan: analysis.pointsFromLastScan.points,
    confidence: analysis.confidence ?? 0,
    // Absolute capture date ("Apr 8") rather than a relative "2 days ago": a
    // relative label needs `Date.now()` in render, which risks a hydration
    // mismatch and breaks the render-purity rule the codebase holds to.
    lastScan: formatScanDate(capturedAt) || '—',
    nextScan: nextScanBanner(capturedAt).inLabel,
    stats: buildStats(analysis, comparison),
  }

  return { data, isReal: true }
}
