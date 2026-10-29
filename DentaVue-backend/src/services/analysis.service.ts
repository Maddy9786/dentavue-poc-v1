import { supabaseAdmin } from '@/config/supabase.js'
import { env } from '@/config/env.js'
import { logger } from '@/config/logger.js'
import * as analysisModel from '@/models/analysis.model.js'
import * as scanModel from '@/models/scan.model.js'
import { generateJson, isGeminiConfigured, PROMPT_VERSION } from '@/integrations/gemini.js'
import {
  NARRATIVE_SYSTEM_INSTRUCTION,
  VISION_SYSTEM_INSTRUCTION,
  narrativePrompt,
  narrativeSchema,
  visionPrompt,
  visionSchema,
} from '@/integrations/geminiPrompts.js'
import {
  CONFIDENCE_FLOOR,
  RUBRIC_VERSION,
  bandMap,
  comparisonNote,
  computeConfidence,
  computeScore,
  deriveComparison,
  deriveGlance,
  deriveRisk,
  isReadable,
  scoreDelta,
  scoreParameters,
  validAnnotations,
} from '@/services/scoring.js'
import { ApiError } from '@/utils/ApiError.js'
import { PARAMETERS } from '@/types/analysis.js'
import type {
  AnalysisDto,
  Band,
  ComparisonDto,
  NarrativeDto,
  ParameterKey,
  VisionResult,
} from '@/types/analysis.js'

/**
 * The AI analysis pipeline.
 *
 * THE RULE, restated because everything here depends on it: the model observes,
 * the backend decides. Pass 1 asks Gemini for per-parameter severities and
 * boxes — nothing else. scoring.ts turns those into bands, a score, deltas and
 * every field a screen renders. Pass 2 then writes the prose, and is GIVEN the
 * computed numbers so it cannot contradict them.
 *
 *     images ──► pass 1 (vision) ──► scoring.ts ──► pass 2 (text) ──► persist
 *
 * Analysis runs asynchronously after POST /scans has already responded, so a
 * slow or failed model never blocks an upload. The web app's analysing screen
 * polls GET /scans/:id/analysis, which is the only reason `status` exists.
 */

const BUCKET = 'scans'

/**
 * Shown to the user when a capture is too poor to read (see USABLE_CONFIDENCE_FLOOR).
 * Kept short and actionable — it is the error string the retake screen displays,
 * so it must tell the user exactly what to change, not what went wrong internally.
 */
const UNREADABLE_MESSAGE =
  "We couldn't clearly see your teeth in these photos. Retake your scan with your mouth closer to the camera, filling the frame, in good light."

/** Sized for four images plus the rubric; well clear of a normal response. */
const VISION_MAX_TOKENS = 2_048
/** Pass 2 writes a few short paragraphs. */
const NARRATIVE_MAX_TOKENS = 1_536

/**
 * A small reasoning budget measurably helps pass 1 weigh evidence across four
 * frames. Pass 2 is a formatting job, so it asks for none.
 *
 * "None" means the field is OMITTED, not sent as 0 — Gemini 3.x rejects a zero
 * budget with a bare 400 (those models always reason). See gemini.ts.
 */
const VISION_THINKING_BUDGET = 512
const NARRATIVE_THINKING_BUDGET = 0

const MIME_BY_EXT: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

function mimeFor(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? 'jpg'
  return MIME_BY_EXT[ext] ?? 'image/jpeg'
}

/**
 * Pulls a scan's frames out of Storage.
 *
 * Downloaded rather than passed by URL: the bucket is private, so a URL would
 * have to be signed and handed to Google, which widens who can reach a personal
 * health image. Bytes go straight from Storage to the model and are never
 * written to disk or logged.
 */
async function downloadImages(
  images: scanModel.ScanImage[],
): Promise<{ mimeType: string; data: Buffer }[]> {
  return Promise.all(
    images.map(async (image) => {
      const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(image.storagePath)
      if (error || !data) {
        logger.error({ err: error, storagePath: image.storagePath }, 'Scan image download failed')
        throw new ApiError(502, 'Could not read the scan images')
      }
      return {
        mimeType: mimeFor(image.storagePath),
        data: Buffer.from(await data.arrayBuffer()),
      }
    }),
  )
}

/**
 * Guards against a schema-conformant but nonsensical response. Gemini
 * constrains structure, not sanity — a missing parameter or a severity of 900
 * would still decode, and silently scoring it would be worse than failing.
 */
function assertUsableVision(result: VisionResult): void {
  for (const parameter of PARAMETERS) {
    const observation = result.parameters?.[parameter]
    if (!observation || typeof observation.severity !== 'number') {
      throw new ApiError(502, 'The analysis service returned an incomplete result')
    }
  }
}

/**
 * Runs the full pipeline for one scan and persists the result.
 *
 * Never throws to its caller: this is invoked fire-and-forget from the upload
 * path, so a failure has to land in the database (status `failed`) rather than
 * in an unhandled rejection. The scan itself stays viewable either way.
 */
export async function runAnalysis(userId: string, scanId: string): Promise<void> {
  if (!isGeminiConfigured() || !env.AI_ANALYSIS_ENABLED) {
    logger.info({ scanId }, 'AI analysis skipped — not configured or disabled')
    return
  }

  try {
    await analysisModel.markPending(scanId)

    const scan = await scanModel.findByIdForUser(scanId, userId)
    if (!scan) throw ApiError.notFound('Scan not found')

    const frames = scan.images.length
      ? scan.images
      : [{ position: 0, angle: 'front-teeth', storagePath: scan.storagePath }]

    const images = await downloadImages(frames)

    // --- Pass 1: vision -----------------------------------------------------
    const vision = await generateJson<VisionResult>({
      model: env.GEMINI_MODEL,
      fallbackModels: env.GEMINI_FALLBACK_MODELS,
      systemInstruction: VISION_SYSTEM_INSTRUCTION,
      prompt: visionPrompt(frames.map((frame) => frame.angle)),
      images,
      schema: visionSchema(),
      maxOutputTokens: VISION_MAX_TOKENS,
      thinkingBudget: VISION_THINKING_BUDGET,
      mediaResolution: `MEDIA_RESOLUTION_${env.GEMINI_MEDIA_RESOLUTION}` as const,
    })
    assertUsableVision(vision.data)

    // --- Scoring: the backend decides --------------------------------------
    const previous = await analysisModel.findPreviousReady(userId, scan.capturedAt)
    const scored = scoreParameters(vision.data, previous?.bands ?? {})
    const bands = bandMap(scored)
    const score = computeScore(bands)
    const confidence = computeConfidence(vision.data.parameters)

    // The model saw essentially nothing — a distant selfie, no teeth in frame.
    // Persisting this would show a fabricated "100 / all healthy" on every
    // screen; instead fail the analysis with an actionable message so the app
    // asks for a better capture. Nothing is written to scan_parameters/score.
    if (!isReadable(confidence)) {
      logger.info({ scanId, confidence }, 'Scan unreadable — asking for a retake')
      await analysisModel.markFailed(scanId, UNREADABLE_MESSAGE)
      return
    }

    const provisional = confidence < CONFIDENCE_FLOOR
    const delta = scoreDelta(score, previous?.score ?? null, provisional)

    // --- Pass 2: narrative, given the computed numbers ----------------------
    let narrative: NarrativeDto | null = null
    let narrativeLatency = 0
    let narrativeIn = 0
    let narrativeOut = 0
    try {
      const written = await generateJson<NarrativeDto>({
        model: env.GEMINI_NARRATIVE_MODEL,
        fallbackModels: env.GEMINI_FALLBACK_MODELS,
        systemInstruction: NARRATIVE_SYSTEM_INSTRUCTION,
        prompt: narrativePrompt({
          score,
          bands: PARAMETERS.map((parameter) => ({
            parameter,
            band: bands[parameter],
            regions: vision.data.parameters[parameter].regions ?? [],
          })),
          observations: vision.data.observations ?? [],
          provisional,
          trend: delta.direction,
          isFirstScan: previous === null,
        }),
        schema: narrativeSchema(),
        maxOutputTokens: NARRATIVE_MAX_TOKENS,
        thinkingBudget: NARRATIVE_THINKING_BUDGET,
      })
      narrative = withIds(written.data)
      narrativeLatency = written.latencyMs
      narrativeIn = written.inputTokens
      narrativeOut = written.outputTokens
    } catch (err) {
      // The numbers are the product; the prose is a bonus. A failed pass 2
      // still leaves a complete, renderable result rather than losing pass 1's
      // work (and its cost) to a formatting hiccup.
      logger.warn({ err, scanId }, 'Narrative pass failed; keeping the scored result')
    }

    await analysisModel.saveAnalysis({
      scanId,
      score,
      confidence,
      provisional,
      narrative,
      // The model that ANSWERED — may be a fallback if the primary was busy.
      model: vision.model,
      promptVersion: PROMPT_VERSION,
      rubricVersion: RUBRIC_VERSION,
      latencyMs: vision.latencyMs + narrativeLatency,
      inputTokens: vision.inputTokens + narrativeIn,
      outputTokens: vision.outputTokens + narrativeOut,
      parameters: scored,
      annotations: validAnnotations(vision.data.annotations ?? [], frames.length),
    })

    // Keep scans.score in sync so the existing list endpoint needs no join.
    await scanModel.setScore(scanId, score)

    logger.info(
      { scanId, score, confidence, provisional, latencyMs: vision.latencyMs + narrativeLatency },
      'Scan analysis complete',
    )
  } catch (err) {
    const message = err instanceof ApiError ? err.message : 'Analysis failed'
    logger.error({ err, scanId }, 'Scan analysis failed')
    await analysisModel.markFailed(scanId, message).catch(() => undefined)
  }
}

/**
 * Gives the narrative's items stable ids. The model is not asked for them —
 * an id is a client concern and inventing them is a job for code, not a model
 * whose output would drift between runs.
 */
function withIds(narrative: NarrativeDto): NarrativeDto {
  return {
    ...narrative,
    findings: (narrative.findings ?? []).map((finding, index) => ({
      ...finding,
      id: `finding-${index}`,
    })),
    actions: (narrative.actions ?? []).map((action) => ({ ...action, id: action.icon })),
    monitor: narrative.monitor ?? null,
    insight: narrative.insight ?? null,
  }
}

/**
 * Starts analysis for a scan that has never had it, WITHOUT awaiting it.
 *
 * This is what makes opening Compare or AI-insight "do the AI call": those
 * screens are reached from Home for a scan that may predate the AI layer, or
 * whose upload-time analysis never ran (no key then, or it failed to dispatch).
 * Reading the analysis is a request to see it, so a missing one is started here
 * and the client polls until it lands.
 *
 * Fire-and-forget and self-guarding: runAnalysis `markPending`s within
 * milliseconds, so the next poll finds a row and does not re-fire. A no-op when
 * analysis is unconfigured or disabled — the caller then reports `failed`, and
 * the screen keeps its placeholder copy.
 */
function startAnalysisInBackground(userId: string, scanId: string): void {
  if (!isGeminiConfigured() || !env.AI_ANALYSIS_ENABLED) return
  void runAnalysis(userId, scanId).catch((err: unknown) => {
    logger.error({ err, scanId }, 'On-demand analysis dispatch failed')
  })
}

/**
 * The analysis for one of the caller's scans.
 *
 * Ownership is checked by loading the scan through the user-scoped finder
 * first, so a caller cannot read another user's analysis by guessing a uuid.
 * A scan with no analysis row STARTS one (see startAnalysisInBackground) and
 * reads as `pending` rather than 404 — the web app polls this until it is ready,
 * and a 404 would be indistinguishable from a bad scan id.
 */
export async function getAnalysis(userId: string, scanId: string): Promise<AnalysisDto> {
  const scan = await scanModel.findByIdForUser(scanId, userId)
  if (!scan) throw ApiError.notFound('Scan not found')

  const record = await analysisModel.findByScanId(scanId)
  if (!record) {
    if (isGeminiConfigured() && env.AI_ANALYSIS_ENABLED) {
      startAnalysisInBackground(userId, scanId)
      return emptyAnalysis(scanId, 'pending')
    }
    return emptyAnalysis(scanId, 'failed')
  }

  if (record.status !== 'ready') {
    const dto = emptyAnalysis(scanId, record.status)
    return { ...dto, error: record.error }
  }

  const previous = await analysisModel.findPreviousReady(userId, scan.capturedAt)
  const bands: Record<ParameterKey, Band> = bandMap(record.parameters)
  const score = record.score ?? computeScore(bands)
  const delta = scoreDelta(score, previous?.score ?? null, record.provisional)

  return {
    scanId,
    status: 'ready',
    error: null,
    score,
    confidence: record.confidence,
    provisional: record.provisional,
    pointsFromLastScan: delta,
    parameters: record.parameters,
    risk: deriveRisk(record.parameters),
    glance: deriveGlance(record.parameters, previous?.bands ?? {}, record.provisional),
    annotations: record.annotations,
    narrative: record.narrative,
    rubricVersion: record.rubricVersion,
  }
}

function emptyAnalysis(scanId: string, status: 'pending' | 'failed'): AnalysisDto {
  return {
    scanId,
    status,
    error: null,
    score: null,
    confidence: null,
    provisional: false,
    pointsFromLastScan: { points: 0, direction: 'stable' },
    parameters: [],
    risk: [],
    glance: [],
    annotations: [],
    narrative: null,
    rubricVersion: null,
  }
}

/**
 * Re-runs analysis for a scan the caller owns. Used by the retry affordance on
 * a failed analysis, and after a rubric change during development.
 */
export async function reanalyse(userId: string, scanId: string): Promise<void> {
  const scan = await scanModel.findByIdForUser(scanId, userId)
  if (!scan) throw ApiError.notFound('Scan not found')
  if (!isGeminiConfigured() || !env.AI_ANALYSIS_ENABLED) {
    throw new ApiError(503, 'AI analysis is not configured')
  }
  await runAnalysis(userId, scanId)
}

// ---------------------------------------------------------------------------
// Comparison
// ---------------------------------------------------------------------------

/**
 * The comparison between the caller's baseline and latest scans.
 *
 * NO VISION CALL. Both scans already carry stored bands, so every metric row,
 * every badge and the overall delta are arithmetic — instant, free, and
 * guaranteed to agree with what each scan's own results screen showed. This is
 * the dividend of doing the scoring at capture time.
 *
 * Pairing matches the web app's comparePair(): one scan → itself (the "single"
 * state), two → both, more → FIRST EVER + LATEST, so the baseline never moves.
 */
export async function getComparison(
  userId: string,
  signImage: (storagePath: string) => Promise<string>,
): Promise<ComparisonDto | null> {
  const scans = await scanModel.listByUser(userId)
  if (scans.length === 0) return null

  const first = scans[0]!
  const latest = scans[scans.length - 1]!
  const single = scans.length === 1

  const [fromRecord, toRecord] = await Promise.all([
    analysisModel.findByScanId(first.id),
    analysisModel.findByScanId(latest.id),
  ])

  // Same on-demand rule as getAnalysis: a scan at either end of the comparison
  // with no analysis gets one started now, and the client polls this endpoint
  // until both are ready and the metrics appear. When single, first === latest,
  // so the first guard covers it and the second is skipped.
  if (!fromRecord) startAnalysisInBackground(userId, first.id)
  if (!single && !toRecord) startAnalysisInBackground(userId, latest.id)

  const [fromImage, toImage] = await Promise.all([
    signImage(first.storagePath),
    signImage(latest.storagePath),
  ])

  const fromRef = {
    scanId: first.id,
    capturedAt: first.capturedAt,
    imageUrl: fromImage,
    score: fromRecord?.score ?? null,
  }
  const toRef = {
    scanId: latest.id,
    capturedAt: latest.capturedAt,
    imageUrl: toImage,
    score: toRecord?.score ?? null,
  }

  // Without two analysed scans there is nothing to diff. The screen has a
  // designed "comparison unlocks with your second scan" state for exactly this.
  if (single || !fromRecord || !toRecord || fromRecord.status !== 'ready' || toRecord.status !== 'ready') {
    return {
      from: fromRef,
      to: toRef,
      single: true,
      note: 'Scan again and DentaVue will show what changed, area by area.',
      metrics: [],
      overall: { title: 'Overall', subtitle: 'Awaiting a second scan', points: 0, direction: 'up' },
    }
  }

  const metrics = deriveComparison(bandMap(fromRecord.parameters), bandMap(toRecord.parameters))
  const delta = scoreDelta(toRecord.score ?? 0, fromRecord.score ?? null, toRecord.provisional)
  const attention = metrics.filter((metric) => metric.tone === 'attention').length

  return {
    from: fromRef,
    to: toRef,
    single: false,
    note: comparisonNote(metrics, delta),
    metrics,
    overall: {
      title: 'Overall · since your first scan',
      subtitle: attention > 0 ? 'Recommend a hygiene review' : 'Keep up your routine',
      points: delta.points,
      direction: delta.direction === 'down' ? 'down' : 'up',
    },
  }
}
