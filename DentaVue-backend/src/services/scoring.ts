import {
  BAND_ORDER,
  PARAMETERS,
  type Annotation,
  type Band,
  type CompareMetricDto,
  type CompareMetricTone,
  type Delta,
  type FindingDto,
  type GlanceDto,
  type NarrativeDto,
  type ParameterKey,
  type RiskItemDto,
  type ScoredParameter,
  type VisionResult,
} from '@/types/analysis.js'

/**
 * The rubric. PURE — no network, no database, no model, no clock.
 *
 * This is the module that makes the product's numbers trustworthy, and its
 * purity is the point: every rule below can be exhaustively unit-tested against
 * hand-written severities without an API key or a Supabase project. If a score
 * is ever wrong, it is wrong here, deterministically, and a test can pin it.
 *
 * WHY THIS EXISTS AT ALL. Ask a vision model for a 0-100 oral-health score and
 * it returns a plausible number — and a different plausible number for the same
 * mouth photographed twice. Swings of 10+ points are normal. That would destroy
 * "+4 points from last scan", which is the entire value of longitudinal
 * tracking: the user could not tell a real change from model noise. So the model
 * reports per-parameter severities and this file decides everything else.
 *
 * Three layers absorb the drift, in order of how much work they do:
 *   1. BANDS      — wide buckets, so ±8 of jitter changes nothing at all
 *   2. HYSTERESIS — a band change must clear the boundary by a margin
 *   3. DEADBAND   — a small score delta renders as "stable", not as progress
 *
 * Changing any constant here changes what every historical score MEANS, so bump
 * RUBRIC_VERSION when you do. Because this module is pure and the raw
 * severities are stored in scan_parameters, a rubric change can be replayed
 * over history without re-calling the model.
 */

/** Bump on ANY change to weights, bands, margins or the score formula. */
export const RUBRIC_VERSION = '1.2.0'

/**
 * Weights sum to 100, so the score formula needs no normalisation and a weight
 * reads directly as "percent of the score this parameter can cost".
 *
 * These are a defensible starting point, NOT a clinical calibration — whether
 * inflammation really deserves a quarter of the score is a product/clinical
 * judgement (see the open decisions in AI_INTEGRATION.md). Retuning is a change
 * here plus a test update; no re-prompting, no re-analysis.
 */
export const PARAMETER_WEIGHTS: Record<ParameterKey, number> = {
  gumInflammation: 25,
  plaqueExtent: 20,
  gumMarginRecession: 20,
  enamelWear: 15,
  tissueAppearance: 15,
  calculusStain: 5,
}

/**
 * Bands. `min`/`max` are inclusive over the raw 0-100 severity; `value` is the
 * penalty weight multiplier used by the score.
 *
 * Four buckets, deliberately wide: ordinary run-to-run model variance (roughly
 * ±8) lands in the same bucket and changes nothing downstream. This absorbs
 * most of the drift before any other rule runs.
 *
 * `value` is not the band midpoint — `none` maps to 0 so a clean mouth scores a
 * clean 100, and the rest are spaced to make the curve forgiving at the bottom
 * (an everyday mouth with minor plaque should not read as failing).
 */
export const BANDS: { band: Band; min: number; max: number; value: number }[] = [
  { band: 'none', min: 0, max: 14, value: 0 },
  { band: 'mild', min: 15, max: 39, value: 25 },
  { band: 'moderate', min: 40, max: 69, value: 55 },
  { band: 'marked', min: 70, max: 100, value: 85 },
]

/**
 * How far past a boundary a severity must go to leave the band it was in last
 * scan. Kills boundary flapping — the failure users notice fastest ("it said
 * Watch yesterday and Healthy today"). See bandWithHysteresis for the arithmetic.
 */
export const HYSTERESIS_MARGIN = 6

/** Score changes smaller than this are noise and render as "stable". */
export const DELTA_DEADBAND = 3

/** Below this confidence the scan is provisional: deltas and trends suppressed. */
export const CONFIDENCE_FLOOR = 60

/**
 * Below this confidence the capture is UNREADABLE — the model could not see the
 * mouth well enough to say anything, so there is no result to band, and saving
 * one would be a confident-looking lie.
 *
 * This is a different thing from `provisional` (60): provisional means "we saw
 * enough to score, but not enough to trust a trend". Unreadable means "we saw
 * essentially nothing". The two floors bracket three real cases:
 *
 *   confidence ≥ 60   trustworthy — score + deltas
 *   40 ≤ conf < 60    provisional — score shown, deltas suppressed
 *   confidence < 40   unreadable  — no score; ask for a retake
 *
 * Calibrated against real runs: a proper close-up of a mouth lands at 90+ (both
 * models), while a distant front-camera selfie with no visible teeth lands at
 * 16–28. 40 sits in the empty gap between them, so a genuinely dim-but-usable
 * photo (which floats in the 40s–50s) is kept, not rejected. See
 * computeConfidence for how the number is built.
 */
export const USABLE_CONFIDENCE_FLOOR = 40

/** True when a scan's confidence is too low to have seen anything usable. */
export function isReadable(confidence: number): boolean {
  return confidence >= USABLE_CONFIDENCE_FLOOR
}

/** Per-parameter model confidence below this counts as "uncertain". */
const UNCERTAIN_BELOW = 0.5

// ---------------------------------------------------------------------------
// Bands
// ---------------------------------------------------------------------------

const clamp = (value: number, min: number, max: number): number =>
  Math.min(max, Math.max(min, value))

/** The band a severity falls in, ignoring history. */
export function bandFor(severity: number): Band {
  const value = clamp(Math.round(severity), 0, 100)
  // Linear scan over four entries; the last band's max is 100 so this always hits.
  const found = BANDS.find((entry) => value >= entry.min && value <= entry.max)
  return found?.band ?? 'none'
}

/** The scoring multiplier for a band. */
export function bandValue(band: Band): number {
  return BANDS.find((entry) => entry.band === band)?.value ?? 0
}

/**
 * A per-parameter health index, 0-100, where 100 is clear and lower is worse:
 * `none` 100, `mild` 75, `moderate` 45, `marked` 15 (the whole-score reference
 * points, per parameter).
 *
 * This is the NUMBER the compare screen shows in place of a band word — the same
 * "72 → 64"-style read-out the design asks for, but derived from the BAND, not
 * the raw severity. That is deliberate: reading it off the band means it is
 * exactly as stable as the band, so it does not wobble on model jitter the way a
 * raw-severity number would. It is an index, never a measurement (depth is the
 * one row that stays a `~mm` figure).
 */
export function parameterIndex(band: Band): number {
  return 100 - bandValue(band)
}

/**
 * The band a severity falls in, given what it was last scan. ASYMMETRIC on
 * purpose — "quick to flag, slow to clear":
 *
 *   worsening (raw band is worse than last scan)  → show it AT ONCE, no margin
 *   improving (raw band is better than last scan) → require clearing the
 *                                                    boundary by HYSTERESIS_MARGIN
 *
 * Why the asymmetry. A health tool's cardinal error is hiding a real problem, so
 * a reading that got WORSE must surface immediately. The original symmetric
 * version damped worsening too, and a genuinely moderate gum reading (severity
 * ~45) was pulled back to "mild → Healthy" simply because the previous — and
 * unrelated — scan had been mild. That is exactly the failure this must prevent.
 *
 * Improvement stays damped: a small dip must not be presented as progress that
 * has not really happened. Worked: previously `moderate` (min 40) — it must fall
 * to 40 - 6 = 34 to drop to `mild`. And because worsening sets a new floor while
 * improvement needs the margin, a value oscillating around a boundary still does
 * not flap.
 *
 * With no previous band (a first scan) the raw band is used unchanged.
 */
export function bandWithHysteresis(severity: number, previous: Band | null): Band {
  const raw = bandFor(severity)
  if (previous === null || raw === previous) return raw

  const value = clamp(Math.round(severity), 0, 100)
  const previousIndex = BAND_ORDER.indexOf(previous)
  const rawIndex = BAND_ORDER.indexOf(raw)

  // Worsening — surface it immediately.
  if (rawIndex > previousIndex) return raw

  // Improving — only once the boundary is cleared by the margin.
  const current = BANDS[previousIndex]
  if (!current) return raw
  return value <= current.min - HYSTERESIS_MARGIN ? raw : previous
}

// ---------------------------------------------------------------------------
// Score
// ---------------------------------------------------------------------------

/**
 * Within-band fine penalty interpolation, anchored to the hysteresis-stabilised band.
 *
 * When raw `ScoredParameter[]` are provided, a severity at the bottom of a band
 * (e.g. mild = 15) costs slightly less than the band midpoint, and a severity at
 * the top of the band (e.g. mild = 39) costs slightly more (±6 points around the
 * band's anchor value, or 0..6 within `none`). This gives input-true precision
 * across different mouths while keeping the hysteresis band as the primary anchor.
 */
function interpolatedBandPenalty(band: Band, severity?: number): number {
  const entry = BANDS.find((b) => b.band === band)
  if (!entry) return 0
  if (severity === undefined) return entry.value

  const clamped = clamp(severity, entry.min, entry.max)
  const span = Math.max(1, entry.max - entry.min)
  const ratio = (clamped - entry.min) / span // 0.0 at band floor → 1.0 at band ceiling

  if (band === 'none') {
    // 0–4 severity stays a clean 0 penalty (score 100); 5–14 adds up to 5 penalty points.
    return clamped <= 4 ? 0 : ratio * 5
  }
  // ±6 points around the band's anchor value (e.g. mild 25 → 19..31).
  return clamp(entry.value + (ratio - 0.5) * 12, 0, 95)
}

/**
 * The score: 100 minus each parameter's weighted band penalty.
 *
 *   score = round( 100 - Σ( weight_i × penalty_i / 100 ) )
 *
 * Rounded ONCE, at the end. Rounding per-parameter first would let half-point
 * errors accumulate across six terms and make the result depend on evaluation
 * order — the sort of thing that produces an off-by-one nobody can reproduce.
 *
 * Reference points (band-only): a clean mouth scores 100, all-mild 75,
 * all-moderate 45, all-marked 15. When `parameters` are supplied, within-band
 * severity interpolation refines the penalty within each band.
 */
export function computeScore(
  bands: Record<ParameterKey, Band>,
  parameters?: ScoredParameter[],
): number {
  let penalty = 0
  for (const parameter of PARAMETERS) {
    const scored = parameters?.find((p) => p.parameter === parameter)
    const unitPenalty = interpolatedBandPenalty(bands[parameter], scored?.severity)
    penalty += (PARAMETER_WEIGHTS[parameter] * unitPenalty) / 100
  }
  return clamp(Math.round(100 - penalty), 0, 100)
}

/**
 * Confidence in this scan, 0-100. COMPUTED, never asked of the model — a model's
 * self-report of its own certainty is just another generated number.
 *
 * Three inputs: how good the photos were (from the client-side capture gate),
 * how sure the model was per parameter, and how many parameters it was actively
 * unsure about. The capture-quality term is weighted lower than the model term
 * because a sharp photo of an unclear situation is still unclear.
 *
 * `captureQuality` is 0-1 and defaults to 1 when the client gate has not run —
 * the model-confidence term still carries the result, so an un-gated capture is
 * not falsely penalised.
 */
export function computeConfidence(
  observations: Record<ParameterKey, { confidence: number }>,
  captureQuality = 1,
): number {
  const confidences = PARAMETERS.map((parameter) =>
    clamp(observations[parameter].confidence, 0, 1),
  )
  const mean = confidences.reduce((sum, value) => sum + value, 0) / confidences.length
  const uncertain = confidences.filter((value) => value < UNCERTAIN_BELOW).length

  const base = 100 * (0.4 * clamp(captureQuality, 0, 1) + 0.6 * mean)
  return clamp(Math.round(base) - 5 * uncertain, 0, 100)
}

/**
 * A score change, with the deadband applied.
 *
 * `provisional` forces `stable`: when we could not see well enough to trust the
 * reading, reporting a change would be presenting noise as progress. Likewise a
 * first scan has nothing to compare against.
 */
export function scoreDelta(
  score: number,
  previousScore: number | null,
  provisional = false,
): Delta {
  if (previousScore === null || provisional) return { points: 0, direction: 'stable' }
  const raw = score - previousScore
  if (Math.abs(raw) < DELTA_DEADBAND) return { points: 0, direction: 'stable' }
  return { points: Math.abs(raw), direction: raw > 0 ? 'up' : 'down' }
}

// ---------------------------------------------------------------------------
// Banding a whole vision result
// ---------------------------------------------------------------------------

/**
 * Bands every parameter of a fresh vision result against the previous scan's
 * bands, and returns them in PARAMETERS order (stable ordering means the UI and
 * the database agree without either sorting).
 */
export function scoreParameters(
  vision: VisionResult,
  previousBands: Partial<Record<ParameterKey, Band>> = {},
): ScoredParameter[] {
  return PARAMETERS.map((parameter) => {
    const observation = vision.parameters[parameter]
    const severity = clamp(Math.round(observation.severity), 0, 100)
    return {
      parameter,
      severity,
      confidence: clamp(Math.round(observation.confidence * 100), 0, 100),
      band: bandWithHysteresis(severity, previousBands[parameter] ?? null),
    }
  })
}

/** Convenience: the band lookup the score and the UI derivations both need. */
export function bandMap(scored: ScoredParameter[]): Record<ParameterKey, Band> {
  const map = {} as Record<ParameterKey, Band>
  for (const parameter of PARAMETERS) {
    map[parameter] = scored.find((entry) => entry.parameter === parameter)?.band ?? 'none'
  }
  return map
}

// ---------------------------------------------------------------------------
// UI derivation — none of this is generated by the model
// ---------------------------------------------------------------------------

/**
 * Band → the risk word the Risk assessment screen shows. One level PER band, so
 * the screen actually varies with the reading: collapsing `none` and `mild` into
 * a single "Low" (the previous behaviour) made a healthy-but-not-perfect mouth
 * read as a wall of identical "Low" chips, which looked broken. `mild` now reads
 * "Mild", so a real finding is visible even below the "Medium"/"Attention" tiers.
 */
function levelFor(band: Band): 'Low' | 'Mild' | 'Medium' | 'Attention' {
  if (band === 'marked') return 'Attention'
  if (band === 'moderate') return 'Medium'
  if (band === 'mild') return 'Mild'
  return 'Low'
}

/**
 * How much better/worse a parameter got, in band-value points. Used for the
 * "at a glance" trend and the compare badges — the same deadband logic as the
 * score, so a screen never claims a trend the score would call stable.
 */
function bandDelta(current: Band, previous: Band | null): number {
  if (previous === null) return 0
  // Positive = improved (penalty went down).
  return bandValue(previous) - bandValue(current)
}

/** Rows of the Risk assessment screen, in a fixed display order (all 6 tracked parameters). */
const RISK_ROWS: { id: string; parameter: ParameterKey; title: string; detail: string }[] = [
  {
    id: 'oral-tissue',
    parameter: 'tissueAppearance',
    title: 'Tongue & Cheeks',
    detail: 'Tongue, roof of mouth & inner cheeks',
  },
  {
    id: 'gum-inflammation',
    parameter: 'gumInflammation',
    title: 'Gum Health',
    detail: 'Healthy pink colour vs. redness near the edges',
  },
  {
    id: 'plaque-buildup',
    parameter: 'plaqueExtent',
    title: 'Tooth Cleanliness',
    detail: 'Everyday soft film on tooth surfaces',
  },
  {
    id: 'gum-line-change',
    parameter: 'gumMarginRecession',
    title: 'Gum Line',
    detail: 'How evenly your gums hug each tooth',
  },
  {
    id: 'enamel-wear',
    parameter: 'enamelWear',
    title: 'Tooth Strength',
    detail: 'Surface smoothness and biting edges',
  },
  {
    id: 'tartar-stain',
    parameter: 'calculusStain',
    title: 'Stains & Tartar',
    detail: 'Tea/coffee staining or hardened buildup',
  },
]

/**
 * Translates any clinical/biological words into simple everyday consumer English
 * so stored annotations or older narratives remain 100% friendly and readable.
 */
const JARGON_REPLACEMENTS: [RegExp, string][] = [
  [/\bgingival erythema\b/gi, 'gum redness'],
  [/\berythematous\b/gi, 'red'],
  [/\berythema\b/gi, 'redness'],
  [/\bedema\b/gi, 'puffiness'],
  [/\binflammation\b/gi, 'redness'],
  [/\binflamed\b/gi, 'red and irritated'],
  [/\binterdental papillae\b/gi, 'gum tips between teeth'],
  [/\bpapillae\b/gi, 'gum tips'],
  [/\bpapillary\b/gi, 'gum-tip'],
  [/\bgingival margins?\b/gi, 'gum edges'],
  [/\bgingiva\b/gi, 'gums'],
  [/\bgingival\b/gi, 'gum'],
  [/\bsupragingival calculus\b/gi, 'hardened tartar'],
  [/\bsubgingival calculus\b/gi, 'hardened tartar near the gums'],
  [/\bcalculus\b/gi, 'hardened tartar'],
  [/\bminerali[sz]ed deposits?\b/gi, 'hardened tartar'],
  [/\bbiofilm\b/gi, 'soft plaque buildup'],
  [/\bcervical third\b/gi, 'area near the gum edge'],
  [/\bcervical\b/gi, 'gum-edge'],
  [/\bincisal edges?\b/gi, 'biting edges'],
  [/\bincisal\b/gi, 'biting-edge'],
  [/\bocclusal\b/gi, 'chewing-surface'],
  [/\battrition\b/gi, 'surface wear'],
  [/\bmaxillary\b/gi, 'upper'],
  [/\bmandibular\b/gi, 'lower'],
  [/\banterior teeth\b/gi, 'front teeth'],
  [/\banterior\b/gi, 'front'],
  [/\bposterior teeth\b/gi, 'back teeth'],
  [/\bposterior\b/gi, 'back'],
  [/\bcentral incisors?\b/gi, 'front teeth'],
  [/\blateral incisors?\b/gi, 'front side teeth'],
  [/\bincisors?\b/gi, 'front teeth'],
  [/\bmolars?\b/gi, 'back chewing teeth'],
  [/\bdorsal tongue\b/gi, 'top of the tongue'],
  [/\boral mucosa\b/gi, 'inner cheeks and mouth lining'],
  [/\bmucosal?\b/gi, 'mouth lining'],
  [/\babnormalit(?:y|ies)\b/gi, 'unusual spots'],
  [/\brecession\b/gi, 'gum line drop'],
]

export function friendlyText(text: string): string {
  let out = text
  for (const [pattern, replacement] of JARGON_REPLACEMENTS) {
    out = out.replace(pattern, replacement)
  }
  return out
}

const FRAME_AREA_NAMES: Record<number, string> = {
  0: 'front teeth',
  1: 'upper gums',
  2: 'tongue',
  3: 'lower gums',
}

function annotationLocationsFor(parameter: ParameterKey, annotations: Annotation[]): string[] {
  const matches = annotations.filter((a) => a.parameter === parameter)
  if (matches.length === 0) return []
  const seen = new Set<string>()
  const result: string[] = []
  for (const match of matches) {
    const frameName = FRAME_AREA_NAMES[match.position] ?? 'mouth photo'
    const label = friendlyText(match.label.trim())
    const phrase = label.toLowerCase().includes(frameName) ? label : `${frameName} · ${label}`
    if (!seen.has(phrase.toLowerCase())) {
      seen.add(phrase.toLowerCase())
      result.push(phrase)
    }
  }
  return result.slice(0, 2)
}

/**
 * The Risk assessment rows. `detail` gains the regions the model actually saw
 * when it named any (or from stored annotations on read) — keeping every row
 * inline with the highlighted boxes on the scan photos.
 */
export function deriveRisk(
  scored: ScoredParameter[],
  vision: VisionResult | null = null,
  annotations: Annotation[] = [],
): RiskItemDto[] {
  const bands = bandMap(scored)
  return RISK_ROWS.map((row) => {
    const band = bands[row.parameter]
    const visionRegions = (vision?.parameters[row.parameter]?.regions ?? []).map(friendlyText)
    const regions =
      visionRegions.length > 0 ? visionRegions : annotationLocationsFor(row.parameter, annotations)
    return {
      id: row.id,
      title: row.title,
      detail: regions.length > 0 ? `${row.detail} · ${regions.join(', ')}` : row.detail,
      level: levelFor(band),
      tone: band === 'marked' ? ('attention' as const) : ('good' as const),
    }
  })
}

const GLANCE_ROWS: {
  id: string
  parameter: ParameterKey
  icon: GlanceDto['icon']
  title: string
  byBand: Record<Band, string>
}[] = [
  {
    id: 'gum-health',
    parameter: 'gumInflammation',
    icon: 'gum',
    title: 'Gum Health',
    byBand: {
      none: 'Gums look calm, pink and settled.',
      mild: 'Slight redness near a few gum edges · easy to settle with soft brushing.',
      moderate: 'Noticeable redness or puffiness along the gum edge.',
      marked: 'Pronounced gum redness and puffiness that needs gentle care.',
    },
  },
  {
    id: 'enamel',
    parameter: 'enamelWear',
    icon: 'enamel',
    title: 'Tooth Strength',
    byBand: {
      none: 'Tooth surfaces and biting edges look strong and smooth.',
      mild: 'Strong overall · minor everyday wear on the biting edges.',
      moderate: 'Visible wear or small rough spots on the biting edges.',
      marked: 'Distinct edge wear noticed — worth having a dentist check.',
    },
  },
  {
    id: 'oral-tissue',
    parameter: 'tissueAppearance',
    icon: 'tissue',
    title: 'Tongue & Cheeks',
    byBand: {
      none: 'Tongue and inner cheeks look clear and healthy.',
      mild: 'Light everyday coating on the tongue surface.',
      moderate: 'Noticeable tongue coating or surface spot observed.',
      marked: 'Heavy tongue coating or a spot worth a closer look.',
    },
  },
  {
    id: 'plaque-risk',
    parameter: 'plaqueExtent',
    icon: 'plaque',
    title: 'Tooth Cleanliness',
    byBand: {
      none: 'Teeth look clean with very little soft buildup.',
      mild: 'A thin film of soft buildup near the gum edge.',
      moderate: 'Visible soft buildup — give extra brush time along the gums.',
      marked: 'Heavy soft buildup across several teeth.',
    },
  },
  {
    id: 'gum-line',
    parameter: 'gumMarginRecession',
    icon: 'gum',
    title: 'Gum Line',
    byBand: {
      none: 'Gums are sitting evenly and snugly around your teeth.',
      mild: 'Gum edge sits slightly lower on 1–2 teeth.',
      moderate: 'Gum line looks noticeably lower on a few teeth.',
      marked: 'Pronounced drop in the gum line exposing more of the tooth.',
    },
  },
  {
    id: 'tartar-stain',
    parameter: 'calculusStain',
    icon: 'plaque',
    title: 'Stains & Tartar',
    byBand: {
      none: 'No hardened tartar or surface staining seen.',
      mild: 'Light tea/coffee stain or a trace of tartar between teeth.',
      moderate: 'Visible hardened tartar or surface staining on several teeth.',
      marked: 'Heavy tartar buildup or dark staining that needs a professional clean.',
    },
  },
]

/**
 * The "at a glance" cards.
 *
 * `status` prefers the trend when there is a real one — "Improving" is more
 * useful than "Healthy" to someone tracking a change — and falls back to the
 * band. `provisional` suppresses trends entirely: no arrow, no percentage.
 */
export function deriveGlance(
  scored: ScoredParameter[],
  previousBands: Partial<Record<ParameterKey, Band>> = {},
  provisional = false,
  annotations: Annotation[] = [],
): GlanceDto[] {
  const bands = bandMap(scored)
  return GLANCE_ROWS.map((row) => {
    const band = bands[row.parameter]
    const watch = band === 'moderate' || band === 'marked'
    const delta = provisional ? 0 : bandDelta(band, previousBands[row.parameter] ?? null)

    let status: string
    if (delta > 0) status = 'Improving'
    else if (watch) status = 'Watch'
    else if (row.parameter === 'tissueAppearance') status = 'Normal'
    else status = 'Healthy'

    const baseDescription = row.byBand[band]
    const locations = band !== 'none' ? annotationLocationsFor(row.parameter, annotations) : []
    const description =
      locations.length > 0 ? `${baseDescription} (${locations[0]})` : baseDescription

    return {
      id: row.id,
      icon: row.icon,
      title: row.title,
      description,
      status,
      // Tone follows the band, not the trend: something improving from `marked`
      // is still worth watching, and the colour should say so.
      tone: watch ? ('watch' as const) : ('positive' as const),
      trend: delta === 0 ? 'stable' : `${Math.abs(delta)}%`,
    }
  })
}

// ---------------------------------------------------------------------------
// Approximate depth
// ---------------------------------------------------------------------------

/**
 * Gum margin depth as an APPROXIMATE, banded figure — derived from
 * gumMarginRecession, so it can never disagree with the recession reading
 * shown elsewhere on the same screen.
 *
 * Always the tilde, never a decimal. Periodontal depth is measured with a probe
 * in a chair; a photograph cannot produce "3.2 mm", and printing one
 * significant figure where the method supports none is the actual dishonesty.
 * The tilde is the visible signal that this is an observation, not a
 * measurement — the accompanying label and caption say so in words (see the
 * web app's compare screen).
 */
const DEPTH_BY_BAND: Record<Band, string> = {
  none: '~1 mm',
  mild: '~2 mm',
  moderate: '~3 mm',
  marked: '~4 mm+',
}

export function approximateDepth(band: Band): string {
  return DEPTH_BY_BAND[band]
}

// ---------------------------------------------------------------------------
// Comparison — pure arithmetic over two stored scans, no model call
// ---------------------------------------------------------------------------

const COMPARE_ROWS: { id: string; parameter: ParameterKey; label: string }[] = [
  // Framed as a health INDEX (high = healthy) so the number reads the right way:
  // the row shows parameterIndex(band), and "up" is good, matching the badge.
  { id: 'gum-inflammation', parameter: 'gumInflammation', label: 'Gum Health' },
  { id: 'plaque', parameter: 'plaqueExtent', label: 'Tooth Cleanliness' },
  { id: 'depth', parameter: 'gumMarginRecession', label: 'Gum Line (est.)' },
  { id: 'tissue', parameter: 'tissueAppearance', label: 'Tongue & Cheeks' },
  { id: 'enamel', parameter: 'enamelWear', label: 'Tooth Strength' },
  { id: 'tartar-stain', parameter: 'calculusStain', label: 'Stains & Tartar' },
]

/**
 * Compare metric rows. Both sides are already banded and stored, so this needs
 * no vision call at all — it is arithmetic, which is why the comparison is
 * guaranteed to agree with what each scan's own results screen showed.
 *
 * The badge is DERIVED from the delta, never chosen: `Mild → Marked` is
 * arithmetically incapable of producing "Stable".
 */
export function deriveComparison(
  fromBands: Record<ParameterKey, Band>,
  toBands: Record<ParameterKey, Band>,
): CompareMetricDto[] {
  return COMPARE_ROWS.map((row) => {
    const from = fromBands[row.parameter]
    const to = toBands[row.parameter]
    const delta = bandDelta(to, from)

    let tone: CompareMetricTone
    let badge: string
    if (delta > 0) {
      tone = 'improving'
      badge = 'Improving'
    } else if (delta < 0 && to === 'marked') {
      tone = 'attention'
      badge = 'Needs Attention'
    } else if (delta < 0) {
      tone = 'attention'
      badge = 'Worsening'
    } else {
      tone = 'stable'
      badge = 'Stable'
    }

    // The depth row is the one that renders as an approximate measurement;
    // every other row is a numeric health index (100 = clear), the "72 → 64"
    // read-out the design asks for — derived from the band, so it is stable.
    const format = row.id === 'depth' ? approximateDepth : (band: Band) => String(parameterIndex(band))
    return { id: row.id, label: row.label, from: format(from), to: format(to), badge, tone }
  })
}

/**
 * The one-line summary above the compare metrics.
 *
 * Deterministic on purpose. It is a single sentence fully determined by the
 * deltas, so generating it would add a network round-trip, a cost and a drift
 * risk to restate what the rows already say. The richer prose (findings,
 * monitor, insight) IS model-generated — see analysis.service.ts pass 2.
 */
export function comparisonNote(metrics: CompareMetricDto[], delta: Delta): string {
  const improved = metrics.filter((metric) => metric.tone === 'improving')
  const worse = metrics.filter((metric) => metric.tone === 'attention')

  if (delta.direction === 'stable' && improved.length === 0 && worse.length === 0) {
    return 'Little has changed since your last scan — your routine is holding steady.'
  }
  if (worse.length > 0 && improved.length > 0) {
    return `${improved[0]!.label} has improved, while ${worse[0]!.label.toLowerCase()} needs a closer look.`
  }
  if (worse.length > 0) {
    return `${worse[0]!.label} has changed since your last scan — worth keeping an eye on.`
  }
  if (improved.length > 0) {
    return `Nice progress — ${improved[0]!.label.toLowerCase()} has visibly improved.`
  }
  return 'Your areas are holding steady since the last scan.'
}

// ---------------------------------------------------------------------------
// Annotations
// ---------------------------------------------------------------------------

/**
 * Drops annotations the model placed outside the image, inverted, or on a frame
 * that does not exist. A malformed box would render as a circle in the wrong
 * place — worse than no circle at all, because it looks authoritative.
 */
export function validAnnotations(annotations: Annotation[], imageCount: number): Annotation[] {
  return annotations
    .filter((annotation) => {
      const [yMin, xMin, yMax, xMax] = annotation.box
      return (
        Number.isInteger(annotation.position) &&
        annotation.position >= 0 &&
        annotation.position < imageCount &&
        [yMin, xMin, yMax, xMax].every((value) => Number.isFinite(value) && value >= 0 && value <= 1000) &&
        yMax > yMin &&
        xMax > xMin
      )
    })
    .map((annotation) => ({
      ...annotation,
      label: friendlyText(annotation.label),
    }))
}

// ---------------------------------------------------------------------------
// Precision Inline Narrative — 100% locked to scored parameters & annotations
// ---------------------------------------------------------------------------

const PARAMETER_FRIENDLY_META: Record<
  ParameterKey,
  {
    name: string
    goodTitle: string
    mildTitle: string
    watchTitle: string
    defaultLocation: string
    careTipTitle: string
    careTipDetail: string
    causes: string[]
    monitorBody: string
    monitorRecommend: string
  }
> = {
  gumInflammation: {
    name: 'Gum Health',
    goodTitle: 'Gums look calm, pink and healthy',
    mildTitle: 'Slight gum redness noticed near the gum edge',
    watchTitle: 'Gums look red or slightly puffy along the gum edge',
    defaultLocation: 'Along the gum line',
    careTipTitle: 'Use gentle circular brushing along your gums',
    careTipDetail: 'Angle a soft-bristle brush lightly toward where your gums meet your teeth',
    causes: [
      'Brushing a bit too firmly along the gum edge',
      'Soft everyday plaque sitting near the gum line',
      'Using a toothbrush with firm or worn bristles',
    ],
    monitorBody:
      'Your photos show noticeable redness or puffiness along the gum edge. Gentle circular brushing and daily cleaning between teeth usually help calm this down within two weeks.',
    monitorRecommend: 'having a dentist or hygienist take a quick look if it stays red or bleeds.',
  },
  plaqueExtent: {
    name: 'Tooth Cleanliness',
    goodTitle: 'Tooth surfaces look clean and well-brushed',
    mildTitle: 'A thin layer of soft everyday buildup noticed',
    watchTitle: 'Visible soft buildup sitting near the gum line',
    defaultLocation: 'Near the gum edge and side teeth',
    careTipTitle: 'Spend an extra 30 seconds brushing along the gum edge',
    careTipDetail: 'Clean gently between your teeth before bedtime to clear soft buildup',
    causes: [
      'Spots near the gum line or back teeth that a quick brush can miss',
      'Skipping daily cleaning between teeth',
      'Snacking or sugary drinks between meals',
    ],
    monitorBody:
      'We noticed visible soft buildup on several teeth. Because soft plaque can irritate gums if left behind, giving those spots a little extra gentle brushing each night makes a big difference.',
    monitorRecommend: 'a routine hygiene clean if the buildup feels hard to brush away.',
  },
  gumMarginRecession: {
    name: 'Gum Line',
    goodTitle: 'Gums are sitting evenly around your teeth',
    mildTitle: 'Gum edge sits slightly lower on a couple of teeth',
    watchTitle: 'Gum line sits noticeably lower on a few teeth',
    defaultLocation: 'Front and side gum edges',
    careTipTitle: 'Ease off brushing pressure along the gum line',
    careTipDetail: 'Use a soft brush and avoid scrubbing side-to-side across the gums',
    causes: [
      'Scrubbing side-to-side with too much pressure',
      'Using a medium or hard-bristled toothbrush',
      'Clenching or grinding teeth at night',
    ],
    monitorBody:
      'The gum edge looks slightly lower on a few teeth. Switching to a soft toothbrush and light circular strokes helps protect your gum line from dropping further.',
    monitorRecommend: 'mentioning this at your next routine dental visit so they can track it.',
  },
  enamelWear: {
    name: 'Tooth Strength',
    goodTitle: 'Tooth surfaces and biting edges look strong',
    mildTitle: 'Gentle everyday wear on the biting edges',
    watchTitle: 'Noticeable wear or roughness on the biting edges',
    defaultLocation: 'Front biting edges',
    careTipTitle: 'Protect your tooth edges from acid and grinding',
    careTipDetail: 'Rinse with water after acidic drinks and wait 30 minutes before brushing',
    causes: [
      'Everyday biting wear or clenching teeth during sleep',
      'Acidic drinks like citrus, soda, or sparkling water',
      'Brushing immediately after acidic food or drinks',
    ],
    monitorBody:
      'Your front biting edges show some visible surface wear. Using a fluoride toothpaste and avoiding brushing right after acidic drinks helps keep the surface strong.',
    monitorRecommend: 'asking your dentist whether a night guard or enamel care would help.',
  },
  tissueAppearance: {
    name: 'Tongue & Cheeks',
    goodTitle: 'Tongue and inner cheeks look clear and healthy',
    mildTitle: 'Light everyday coating on the tongue surface',
    watchTitle: 'Noticeable coating or surface change on the tongue',
    defaultLocation: 'Top surface of the tongue',
    careTipTitle: 'Gently clean your tongue surface each morning',
    careTipDetail: 'Brush or use a tongue scraper from back to front and stay well hydrated',
    causes: [
      'Everyday food film settling on the tongue overnight',
      'Not drinking enough water during the day',
      'Coffee, tea, or dry mouth from mouth-breathing',
    ],
    monitorBody:
      'We noticed a visible coating on the tongue surface. Gentle daily tongue cleaning and drinking plenty of water usually refreshes this within a few days.',
    monitorRecommend: 'having a dentist check any spot or patch that lasts more than two weeks.',
  },
  calculusStain: {
    name: 'Stains & Tartar',
    goodTitle: 'No hardened tartar or surface staining seen',
    mildTitle: 'Light surface staining or trace tartar between teeth',
    watchTitle: 'Hardened tartar or dark staining noticed near the gums',
    defaultLocation: 'Between the front teeth near the gum line',
    careTipTitle: 'Clean between your lower front teeth daily',
    careTipDetail: 'Daily interdental cleaning stops soft plaque from hardening into tartar',
    causes: [
      'Everyday tea, coffee, or dark food pigments',
      'Soft plaque left between teeth that hardened over time',
      'Tight spaces between lower front teeth where minerals build up',
    ],
    monitorBody:
      'Some hardened tartar or surface staining is visible near the gum line. Once plaque hardens into tartar, regular brushing cannot remove it — only a gentle professional scale and polish can.',
    monitorRecommend: 'booking a routine scale and polish with a dental hygienist.',
  },
}

/**
 * Deterministically builds a 100% inline, everyday-friendly NarrativeDto from
 * the 6 scored parameters and annotations, or sanitizes and aligns a model-generated
 * narrative so it never contradicts the 6 Glance cards or Risk rows.
 */
export function buildInlineNarrative(
  scored: ScoredParameter[],
  annotations: Annotation[],
  delta: Delta,
): NarrativeDto {
  const sorted = [...scored].sort((a, b) => {
    const bandDiff = bandValue(b.band) - bandValue(a.band)
    if (bandDiff !== 0) return bandDiff
    return b.severity - a.severity
  })

  const topThree = sorted.slice(0, 3)
  const findings: FindingDto[] = topThree.map((entry, index) => {
    const meta = PARAMETER_FRIENDLY_META[entry.parameter]
    const watch = entry.band === 'moderate' || entry.band === 'marked'
    const locations = annotationLocationsFor(entry.parameter, annotations)
    const title = watch
      ? meta.watchTitle
      : entry.band === 'mild'
        ? meta.mildTitle
        : meta.goodTitle
    const detail =
      locations.length > 0
        ? `Seen on ${locations.join(' and ')}`
        : `${meta.defaultLocation} · ${entry.band === 'none' ? 'all clear' : `${entry.band} level`}`

    return {
      id: `finding-${index}`,
      title,
      detail,
      status: watch ? 'watch' : 'good',
    }
  })

  const worst = sorted[0]!
  const worstMeta = PARAMETER_FRIENDLY_META[worst.parameter]
  const worstLocations = annotationLocationsFor(worst.parameter, annotations)
  const worstWatch = worst.band === 'moderate' || worst.band === 'marked'
  const watchItems = scored.filter((s) => s.band === 'moderate' || s.band === 'marked')
  const healthyCount = scored.length - watchItems.length

  const monitor = worstWatch
    ? {
        badge: 'Keep an eye on',
        title:
          worstLocations.length > 0
            ? `${worstMeta.name} · ${worstLocations[0]}`
            : worstMeta.watchTitle,
        body: worstMeta.monitorBody,
        recommended: worstMeta.monitorRecommend,
      }
    : null

  const actions = [
    {
      id: 'floss',
      icon: 'floss' as const,
      title: worstMeta.careTipTitle,
      detail:
        worstLocations.length > 0
          ? `Focus on ${worstLocations[0]} — ${worstMeta.careTipDetail.toLowerCase()}`
          : worstMeta.careTipDetail,
    },
    {
      id: 'rescan',
      icon: 'rescan' as const,
      title: 'Take a check-in scan in 2 weeks',
      detail: worstWatch
        ? `Track how your ${worstMeta.name.toLowerCase()} settles with gentle daily care`
        : 'Keep tracking all 6 mouth areas to maintain your healthy routine',
    },
  ]

  const insightStatus = worstWatch
    ? 'Watch'
    : delta.direction === 'up'
      ? 'Improving'
      : 'Healthy'

  const insightTitle = worstWatch
    ? `${worstMeta.name} needs a little extra care`
    : worst.band === 'mild'
      ? `Overall healthy · minor note on ${worstMeta.name.toLowerCase()}`
      : 'All 6 mouth areas look clean and healthy'

  const insightSummary = worstWatch
    ? `${healthyCount} of your 6 tracked mouth areas look good, while ${watchItems.map((w) => PARAMETER_FRIENDLY_META[w.parameter].name.toLowerCase()).join(' and ')} ${watchItems.length === 1 ? 'shows' : 'show'} changes worth gentle daily attention${worstLocations.length > 0 ? ` (especially around ${worstLocations[0]})` : ''}. ${worstMeta.careTipDetail} over the next two weeks to help it settle.`
    : worst.band === 'mild'
      ? `All 6 tracked mouth areas are in a good range, with only a mild everyday note on ${worstMeta.name.toLowerCase()}${worstLocations.length > 0 ? ` around ${worstLocations[0]}` : ''}. Keeping up your daily brushing and cleaning between teeth will help keep your mouth in great shape.`
      : 'All 6 tracked areas — gums, enamel, tongue, plaque control, gum line and tartar — look calm and well cared for. Keep up your current brushing and interdental cleaning routine.'

  return {
    findings,
    monitor,
    actions,
    insight: {
      title: insightTitle,
      status: insightStatus,
      summary: insightSummary,
      likelyCauses: worstMeta.causes,
      caution:
        'This personal care guide is an everyday wellness summary from your photos, not a medical diagnosis. If you ever notice pain, swelling, or bleeding that does not settle, book a visit with a dentist.',
    },
  }
}

/**
 * Ensures any stored or model-generated narrative is 100% inline with the 6
 * scored parameters, strips any biological/clinical jargon, and upgrades legacy
 * narratives automatically.
 */
export function alignNarrativeWithScores(
  narrative: NarrativeDto | null,
  isCurrentPromptVersion: boolean,
  scored: ScoredParameter[],
  annotations: Annotation[],
  delta: Delta,
): NarrativeDto {
  const inline = buildInlineNarrative(scored, annotations, delta)
  if (!narrative || !isCurrentPromptVersion) {
    return inline
  }

  const hasWatch = scored.some((s) => s.band === 'moderate' || s.band === 'marked')

  return {
    findings:
      narrative.findings.length > 0
        ? narrative.findings.map((f, idx) => ({
            id: f.id || `finding-${idx}`,
            title: friendlyText(f.title),
            detail: friendlyText(f.detail),
            status: f.status,
          }))
        : inline.findings,
    // Strictly align monitor presence with whether a parameter is actually moderate/marked
    monitor: hasWatch
      ? narrative.monitor
        ? {
            badge: 'Keep an eye on',
            title: friendlyText(narrative.monitor.title),
            body: friendlyText(narrative.monitor.body),
            recommended: friendlyText(narrative.monitor.recommended),
          }
        : inline.monitor
      : null,
    actions:
      narrative.actions.length > 0
        ? narrative.actions.map((a) => ({
            ...a,
            title: friendlyText(a.title),
            detail: friendlyText(a.detail),
          }))
        : inline.actions,
    insight: narrative.insight
      ? {
          title: friendlyText(narrative.insight.title),
          status: inline.insight!.status,
          summary: friendlyText(narrative.insight.summary),
          likelyCauses:
            narrative.insight.likelyCauses.length > 0
              ? narrative.insight.likelyCauses.map(friendlyText)
              : inline.insight!.likelyCauses,
          caution: friendlyText(narrative.insight.caution),
        }
      : inline.insight,
  }
}
