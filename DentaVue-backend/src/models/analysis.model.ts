import { supabaseAdmin } from '@/config/supabase.js'
import { BAND_ORDER, PARAMETERS } from '@/types/analysis.js'
import type {
  Annotation,
  Band,
  NarrativeDto,
  ParameterKey,
  ScoredParameter,
} from '@/types/analysis.js'
import type { IsoDateTime } from '@/types/domain.js'

/**
 * The "M" in MVC for the AI layer: all database access for `scan_analysis`,
 * `scan_parameters` and `scan_annotations` (see 0005_scan_analysis.sql).
 *
 * Persistence only — no model calls, no scoring, no HTTP. The service composes
 * those. Rows are snake_case; the domain is camelCase; this layer maps between.
 */

const ANALYSIS_TABLE = 'scan_analysis'
const PARAMETERS_TABLE = 'scan_parameters'
const ANNOTATIONS_TABLE = 'scan_annotations'

export type AnalysisStatus = 'pending' | 'ready' | 'failed'

export interface AnalysisRecord {
  scanId: string
  status: AnalysisStatus
  error: string | null
  score: number | null
  confidence: number | null
  provisional: boolean
  narrative: NarrativeDto | null
  model: string | null
  promptVersion: string | null
  rubricVersion: string | null
  createdAt: IsoDateTime
  parameters: ScoredParameter[]
  annotations: Annotation[]
}

interface AnalysisRow {
  scan_id: string
  status: AnalysisStatus
  error: string | null
  score: number | null
  confidence: number | null
  provisional: boolean
  narrative: NarrativeDto | null
  model: string | null
  prompt_version: string | null
  rubric_version: string | null
  created_at: IsoDateTime
}

interface ParameterRow {
  scan_id: string
  parameter: string
  severity: number
  confidence: number
  band: string
}

interface AnnotationRow {
  scan_id: string
  position: number
  parameter: string
  y_min: number
  x_min: number
  y_max: number
  x_max: number
  label: string
}

/** Narrows free-text database values back onto the union types. */
function isParameterKey(value: string): value is ParameterKey {
  return (PARAMETERS as readonly string[]).includes(value)
}

function isBand(value: string): value is Band {
  return (BAND_ORDER as readonly string[]).includes(value)
}

function toParameters(rows: ParameterRow[]): ScoredParameter[] {
  // Return in PARAMETERS order, not database order, so callers never have to sort.
  return PARAMETERS.flatMap((parameter) => {
    const row = rows.find((entry) => entry.parameter === parameter)
    if (!row || !isBand(row.band)) return []
    return [
      {
        parameter,
        severity: row.severity,
        confidence: row.confidence,
        band: row.band,
      },
    ]
  })
}

function toAnnotations(rows: AnnotationRow[]): Annotation[] {
  return rows.flatMap((row) => {
    if (!isParameterKey(row.parameter)) return []
    return [
      {
        position: row.position,
        parameter: row.parameter,
        box: [row.y_min, row.x_min, row.y_max, row.x_max] as [number, number, number, number],
        label: row.label,
      },
    ]
  })
}

/**
 * Marks an analysis as in flight. Upsert, so a retry of a failed analysis
 * clears the previous error and score rather than accumulating rows.
 */
export async function markPending(scanId: string): Promise<void> {
  const { error } = await supabaseAdmin.from(ANALYSIS_TABLE).upsert(
    {
      scan_id: scanId,
      status: 'pending',
      error: null,
      score: null,
      confidence: null,
      provisional: false,
      narrative: null,
    },
    { onConflict: 'scan_id' },
  )
  if (error) throw error
}

export async function markFailed(scanId: string, message: string): Promise<void> {
  const { error } = await supabaseAdmin.from(ANALYSIS_TABLE).upsert(
    // Truncated: this string is returned to the client, so it must stay a short
    // human sentence and never carry provider internals.
    { scan_id: scanId, status: 'failed', error: message.slice(0, 300) },
    { onConflict: 'scan_id' },
  )
  if (error) throw error
}

export interface SaveAnalysisInput {
  scanId: string
  score: number
  confidence: number
  provisional: boolean
  narrative: NarrativeDto | null
  model: string
  promptVersion: string
  rubricVersion: string
  latencyMs: number
  inputTokens: number
  outputTokens: number
  parameters: ScoredParameter[]
  annotations: Annotation[]
}

/**
 * Writes a completed analysis.
 *
 * Order matters: children are replaced BEFORE the parent flips to `ready`, so a
 * poller that sees `ready` always finds a complete set. There is no client
 * transaction here (Supabase's JS client has none), so this is the cheap
 * equivalent — the failure window leaves the row `pending`, which the service
 * then marks failed, rather than `ready` with missing parameters.
 */
export async function saveAnalysis(input: SaveAnalysisInput): Promise<void> {
  const { error: deleteParametersError } = await supabaseAdmin
    .from(PARAMETERS_TABLE)
    .delete()
    .eq('scan_id', input.scanId)
  if (deleteParametersError) throw deleteParametersError

  const { error: parametersError } = await supabaseAdmin.from(PARAMETERS_TABLE).insert(
    input.parameters.map((parameter) => ({
      scan_id: input.scanId,
      parameter: parameter.parameter,
      severity: parameter.severity,
      confidence: parameter.confidence,
      band: parameter.band,
    })),
  )
  if (parametersError) throw parametersError

  const { error: deleteAnnotationsError } = await supabaseAdmin
    .from(ANNOTATIONS_TABLE)
    .delete()
    .eq('scan_id', input.scanId)
  if (deleteAnnotationsError) throw deleteAnnotationsError

  if (input.annotations.length > 0) {
    const { error: annotationsError } = await supabaseAdmin.from(ANNOTATIONS_TABLE).insert(
      input.annotations.map((annotation) => ({
        scan_id: input.scanId,
        position: annotation.position,
        parameter: annotation.parameter,
        y_min: annotation.box[0],
        x_min: annotation.box[1],
        y_max: annotation.box[2],
        x_max: annotation.box[3],
        label: annotation.label,
      })),
    )
    if (annotationsError) throw annotationsError
  }

  const { error: analysisError } = await supabaseAdmin.from(ANALYSIS_TABLE).upsert(
    {
      scan_id: input.scanId,
      status: 'ready',
      error: null,
      score: input.score,
      confidence: input.confidence,
      provisional: input.provisional,
      narrative: input.narrative,
      model: input.model,
      prompt_version: input.promptVersion,
      rubric_version: input.rubricVersion,
      latency_ms: input.latencyMs,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
    },
    { onConflict: 'scan_id' },
  )
  if (analysisError) throw analysisError
}

/** One scan's analysis with its parameters and annotations, or null. */
export async function findByScanId(scanId: string): Promise<AnalysisRecord | null> {
  const { data, error } = await supabaseAdmin
    .from(ANALYSIS_TABLE)
    .select('*')
    .eq('scan_id', scanId)
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  const row = data as AnalysisRow

  const [{ data: parameterData, error: parameterError }, { data: annotationData, error: annotationError }] =
    await Promise.all([
      supabaseAdmin.from(PARAMETERS_TABLE).select('*').eq('scan_id', scanId),
      supabaseAdmin.from(ANNOTATIONS_TABLE).select('*').eq('scan_id', scanId).order('position'),
    ])

  if (parameterError) throw parameterError
  if (annotationError) throw annotationError

  return {
    scanId: row.scan_id,
    status: row.status,
    error: row.error,
    score: row.score,
    confidence: row.confidence,
    provisional: row.provisional,
    narrative: row.narrative,
    model: row.model,
    promptVersion: row.prompt_version,
    rubricVersion: row.rubric_version,
    createdAt: row.created_at,
    parameters: toParameters((parameterData ?? []) as ParameterRow[]),
    annotations: toAnnotations((annotationData ?? []) as AnnotationRow[]),
  }
}

/**
 * The bands of the caller's most recent READY analysis before `beforeScanId`'s
 * capture time — the baseline for hysteresis and for the delta.
 *
 * Joins through `scans` so one user can never read another's history: the
 * user_id filter is applied in the same query, not afterwards.
 */
export async function findPreviousReady(
  userId: string,
  capturedAt: IsoDateTime,
): Promise<{ scanId: string; score: number | null; bands: Partial<Record<ParameterKey, Band>> } | null> {
  const { data, error } = await supabaseAdmin
    .from('scans')
    .select('id, captured_at, scan_analysis!inner(score, status)')
    .eq('user_id', userId)
    .lt('captured_at', capturedAt)
    .eq('scan_analysis.status', 'ready')
    .order('captured_at', { ascending: false })
    .limit(1)

  if (error) throw error
  const row = (data as { id: string; scan_analysis: { score: number | null }[] }[] | null)?.[0]
  if (!row) return null

  const { data: parameterData, error: parameterError } = await supabaseAdmin
    .from(PARAMETERS_TABLE)
    .select('*')
    .eq('scan_id', row.id)
  if (parameterError) throw parameterError

  const bands: Partial<Record<ParameterKey, Band>> = {}
  for (const parameter of toParameters((parameterData ?? []) as ParameterRow[])) {
    bands[parameter.parameter] = parameter.band
  }

  // Supabase returns an embedded to-one join as an array of length 1.
  const score = Array.isArray(row.scan_analysis) ? (row.scan_analysis[0]?.score ?? null) : null
  return { scanId: row.id, score, bands }
}
