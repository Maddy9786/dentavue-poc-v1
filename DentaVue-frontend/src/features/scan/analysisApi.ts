import { baseApi } from '@/services/api/baseApi'
import type { ApiEnvelope } from '@/types/api'

/**
 * Scan-analysis endpoints — the AI layer's read side.
 *
 * Mirrors the backend's src/types/analysis.ts. Not in the API spec (it stops
 * before scans — see CLAUDE.md); designed alongside the backend.
 *
 * THE CONTRACT WORTH KNOWING: none of the numbers below come from the AI model.
 * Gemini reports per-parameter severities and bounding boxes; the backend's
 * scoring.ts bands them, applies hysteresis against the previous scan, and
 * derives the score, levels, badges and trends. That is why a re-scan of the
 * same mouth does not make the score jump — and why the UI must render these
 * values as given rather than recomputing anything from `parameters`.
 *
 * See AI_INTEGRATION.md in the parent directory for the full design.
 */

/** The six things the model judges. Severity is stored but never rendered. */
export type ParameterKey =
  | 'gumInflammation'
  | 'plaqueExtent'
  | 'gumMarginRecession'
  | 'enamelWear'
  | 'tissueAppearance'
  | 'calculusStain'

export type Band = 'none' | 'mild' | 'moderate' | 'marked'

export interface ScoredParameter {
  parameter: ParameterKey
  /** Raw model output, 0-100. Audit only — do not derive UI from this. */
  severity: number
  confidence: number
  /** Post-hysteresis. This is what the UI reflects. */
  band: Band
}

/**
 * A region the model localised, in Gemini's native normalised 0-1000 space.
 *
 * Resolution-independent on purpose: multiply by the rendered width/height to
 * place the overlay, so the same stored box works at any display size and a
 * responsive layout needs no re-analysis.
 */
export interface Annotation {
  /** Which of the four frames (0..3), matching Scan.images[].position. */
  position: number
  parameter: ParameterKey
  /** [y_min, x_min, y_max, x_max], 0-1000. */
  box: [number, number, number, number]
  label: string
}

/** A change that cleared the deadband, or `stable` if it was noise. */
export interface Delta {
  points: number
  direction: 'up' | 'down' | 'stable'
}

export interface RiskItem {
  id: string
  title: string
  detail: string
  level: 'Low' | 'Medium' | 'Attention'
  tone: 'good' | 'attention'
}

export interface Glance {
  id: string
  icon: 'gum' | 'enamel' | 'tissue' | 'plaque'
  title: string
  description: string
  status: string
  tone: 'positive' | 'watch'
  trend: string
}

export interface Finding {
  id: string
  title: string
  detail: string
  status: 'good' | 'watch'
}

export interface Action {
  id: string
  icon: 'floss' | 'rescan'
  title: string
  detail: string
}

/**
 * The model-written prose. Produced by a SECOND, text-only pass that is given
 * the computed numbers, so it cannot contradict them. Null when that pass
 * failed — the scored result still renders, which is why every consumer must
 * handle null rather than assuming prose exists.
 */
export interface Narrative {
  findings: Finding[]
  monitor: { badge: string; title: string; body: string; recommended: string } | null
  actions: Action[]
  insight: {
    title: string
    status: string
    summary: string
    likelyCauses: string[]
    caution: string
  } | null
}

export interface Analysis {
  scanId: string
  /**
   * `pending` while the model is working — the analysing screen polls on this.
   * `failed` when it gave up; `error` carries a short human sentence.
   */
  status: 'pending' | 'ready' | 'failed'
  error: string | null
  score: number | null
  confidence: number | null
  /** True when the photos were too poor to trust: deltas are suppressed. */
  provisional: boolean
  pointsFromLastScan: Delta
  parameters: ScoredParameter[]
  risk: RiskItem[]
  glance: Glance[]
  annotations: Annotation[]
  narrative: Narrative | null
  rubricVersion: string | null
}

export interface CompareMetric {
  id: string
  label: string
  from: string
  to: string
  badge: string
  tone: 'improving' | 'stable' | 'attention'
}

export interface ComparisonScan {
  scanId: string
  capturedAt: string
  imageUrl: string
  score: number | null
}

/**
 * Baseline vs. latest. Computed server-side by arithmetic over two stored
 * analyses — no model call — so it always agrees with what each scan's own
 * results screen showed.
 */
export interface Comparison {
  from: ComparisonScan
  to: ComparisonScan
  /** True when there is only one scan, or the second is not analysed yet. */
  single: boolean
  note: string
  metrics: CompareMetric[]
  overall: { title: string; subtitle: string; points: number; direction: 'up' | 'down' }
}

export const analysisApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getAnalysis: builder.query<Analysis, string>({
      query: (scanId) => `/scans/${scanId}/analysis`,
      transformResponse: (r: ApiEnvelope<Analysis>) => r.data,
      providesTags: (_result, _error, scanId) => [{ type: 'Analysis', id: scanId }],
    }),

    /**
     * Retry a failed analysis. Awaited server-side (unlike the automatic run
     * after upload), so this resolves with the finished result rather than a
     * pending one.
     */
    reanalyse: builder.mutation<Analysis, string>({
      query: (scanId) => ({ url: `/scans/${scanId}/analysis`, method: 'POST' }),
      transformResponse: (r: ApiEnvelope<Analysis>) => r.data,
      invalidatesTags: (_result, _error, scanId) => [{ type: 'Analysis', id: scanId }, 'Scan'],
    }),

    /** Null when the user has no scans at all. */
    getComparison: builder.query<Comparison | null, void>({
      query: () => '/scans/comparison',
      transformResponse: (r: ApiEnvelope<Comparison | null>) => r.data,
      providesTags: ['Analysis'],
    }),
  }),
})

export const { useGetAnalysisQuery, useReanalyseMutation, useGetComparisonQuery } = analysisApi
