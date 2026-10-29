/**
 * The AI analysis vocabulary. Mirrored in DentaVue-Web's src/features/scan/analysisApi.ts.
 *
 * See AI_INTEGRATION.md (parent directory) for the reasoning. The rule these
 * types encode: **the model observes, the backend decides.** Everything the
 * model is allowed to say lives in `VisionResult`; everything the user reads
 * lives in `AnalysisDto` and is computed from it by scoring.ts.
 *
 * Note what `VisionResult` does NOT contain: no score, no band, no level, no
 * badge, no trend, no millimetre. Those fields are absent from the response
 * schema sent to Gemini, so the model cannot supply them even if the prompt is
 * edited carelessly. The schema is the enforcement mechanism, not the wording.
 */

/**
 * The six things the model is asked to judge. Chosen to cover exactly what the
 * existing screens display and nothing a photograph cannot support — note the
 * absence of anything requiring an instrument (probe depths, mobility).
 *
 * Order is not significant; the weights in scoring.ts are.
 */
export const PARAMETERS = [
  'gumInflammation',
  'plaqueExtent',
  'gumMarginRecession',
  'enamelWear',
  'tissueAppearance',
  'calculusStain',
] as const

export type ParameterKey = (typeof PARAMETERS)[number]

/** Severity bands, ascending. `marked` is the only one that reads as Attention. */
export const BAND_ORDER = ['none', 'mild', 'moderate', 'marked'] as const
export type Band = (typeof BAND_ORDER)[number]

/** What the model returns for one parameter. Raw, pre-band, never rendered. */
export interface ParameterObservation {
  /** 0-100, higher is worse. Quantised into a band before anything uses it. */
  severity: number
  /** The model's own confidence in this reading, 0-1. */
  confidence: number
  /** Where it was seen, e.g. ['lower-left margin']. Feeds the narrative pass. */
  regions: string[]
}

/** One localised region, in Gemini's native normalised 0-1000 space. */
export interface Annotation {
  /** Which of the four frames (0..3), matching scan_images.position. */
  position: number
  parameter: ParameterKey
  /** [y_min, x_min, y_max, x_max], 0-1000. */
  box: [number, number, number, number]
  label: string
}

/** Pass 1's complete output — the only thing the vision model is asked for. */
export interface VisionResult {
  parameters: Record<ParameterKey, ParameterObservation>
  annotations: Annotation[]
  /** Short factual visual notes. No numbers, no diagnosis. Feeds pass 2. */
  observations: string[]
}

// ---------------------------------------------------------------------------
// Computed — everything below is produced by scoring.ts, never by the model
// ---------------------------------------------------------------------------

/** A parameter after banding, ready to render. */
export interface ScoredParameter {
  parameter: ParameterKey
  /** Kept for audit and for replaying a rubric change over history. */
  severity: number
  confidence: number
  /** Post-hysteresis. Not always the band `severity` alone implies. */
  band: Band
}

/** A change that has cleared the deadband, or `stable` if it has not. */
export interface Delta {
  /** Absolute magnitude, already deadbanded to 0 when it is noise. */
  points: number
  direction: 'up' | 'down' | 'stable'
}

export type MetricTone = 'positive' | 'watch'
export type RiskTone = 'good' | 'attention'

/** Mirrors DentaVue-Web's RiskItem. */
export interface RiskItemDto {
  id: string
  title: string
  detail: string
  level: 'Low' | 'Mild' | 'Medium' | 'Attention'
  tone: RiskTone
}

/** Mirrors DentaVue-Web's ScanResultGlance. */
export interface GlanceDto {
  id: string
  icon: 'gum' | 'enamel' | 'tissue' | 'plaque'
  title: string
  description: string
  status: string
  tone: MetricTone
  trend: string
}

/** Mirrors DentaVue-Web's ScanResultFinding. */
export interface FindingDto {
  id: string
  title: string
  detail: string
  status: 'good' | 'watch'
}

/** Mirrors DentaVue-Web's ScanResultAction. */
export interface ActionDto {
  id: string
  icon: 'floss' | 'rescan'
  title: string
  detail: string
}

/** Pass 2's output. Text only, written knowing the computed numbers. */
export interface NarrativeDto {
  findings: FindingDto[]
  monitor: { badge: string; title: string; body: string; recommended: string } | null
  actions: ActionDto[]
  insight: {
    title: string
    status: string
    summary: string
    likelyCauses: string[]
    caution: string
  } | null
}

/** What GET /scans/:scanId/analysis returns. */
export interface AnalysisDto {
  scanId: string
  status: 'pending' | 'ready' | 'failed'
  /** Present only when status is 'failed'. */
  error: string | null
  score: number | null
  confidence: number | null
  /** True when confidence fell below the floor — deltas are suppressed. */
  provisional: boolean
  pointsFromLastScan: Delta
  parameters: ScoredParameter[]
  risk: RiskItemDto[]
  glance: GlanceDto[]
  annotations: Annotation[]
  narrative: NarrativeDto | null
  /** Which rubric produced `score`. A change makes old scores incomparable. */
  rubricVersion: string | null
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

export type CompareMetricTone = 'improving' | 'stable' | 'attention'

/** Mirrors DentaVue-Web's CompareMetric. */
export interface CompareMetricDto {
  id: string
  label: string
  from: string
  to: string
  badge: string
  tone: CompareMetricTone
}

/** What GET /scans/comparison returns. Pure arithmetic over two stored scans. */
export interface ComparisonDto {
  from: { scanId: string; capturedAt: string; imageUrl: string; score: number | null }
  to: { scanId: string; capturedAt: string; imageUrl: string; score: number | null }
  /** True when both sides are the same scan (the user has only scanned once). */
  single: boolean
  note: string
  metrics: CompareMetricDto[]
  overall: { title: string; subtitle: string; points: number; direction: 'up' | 'down' }
}
