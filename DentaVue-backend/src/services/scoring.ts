import {
  BAND_ORDER,
  PARAMETERS,
  type Annotation,
  type Band,
  type CompareMetricDto,
  type CompareMetricTone,
  type Delta,
  type GlanceDto,
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
export const RUBRIC_VERSION = '1.1.0'

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
 * The score: 100 minus each parameter's weighted band penalty.
 *
 *   score = round( 100 - Σ( weight_i × bandValue_i / 100 ) )
 *
 * Rounded ONCE, at the end. Rounding per-parameter first would let half-point
 * errors accumulate across six terms and make the result depend on evaluation
 * order — the sort of thing that produces an off-by-one nobody can reproduce.
 *
 * Reference points: a clean mouth scores 100, all-mild 75, all-moderate 45,
 * all-marked 15.
 */
export function computeScore(bands: Record<ParameterKey, Band>): number {
  let penalty = 0
  for (const parameter of PARAMETERS) {
    penalty += (PARAMETER_WEIGHTS[parameter] * bandValue(bands[parameter])) / 100
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

/** Rows of the Risk assessment screen, in a fixed display order. */
const RISK_ROWS: { id: string; parameter: ParameterKey; title: string; detail: string }[] = [
  {
    id: 'oral-tissue',
    parameter: 'tissueAppearance',
    title: 'Oral tissue',
    detail: 'Tongue, palate, cheeks',
  },
  {
    id: 'gum-inflammation',
    parameter: 'gumInflammation',
    title: 'Gum inflammation',
    detail: 'Redness along the gum margins',
  },
  {
    id: 'plaque-buildup',
    parameter: 'plaqueExtent',
    title: 'Plaque buildup',
    detail: 'Visible soft deposits',
  },
  {
    id: 'gum-line-change',
    parameter: 'gumMarginRecession',
    // NOT "Upper gum line change" (the placeholder's wording): the model reports
    // wherever it actually sees margin change, and a real run put it on a LOWER
    // incisor while the heading still said "Upper". `detail` carries the true
    // location from the model's regions; the title must not contradict it.
    title: 'Gum line change',
    detail: 'Gum margin position',
  },
]

/**
 * The Risk assessment rows. `detail` gains the regions the model actually saw
 * when it named any — that is the one place model text reaches this screen, and
 * it is a location phrase, never a judgement.
 */
export function deriveRisk(
  scored: ScoredParameter[],
  vision: VisionResult | null = null,
): RiskItemDto[] {
  const bands = bandMap(scored)
  return RISK_ROWS.map((row) => {
    const band = bands[row.parameter]
    const regions = vision?.parameters[row.parameter]?.regions ?? []
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
  healthy: string
  watch: string
}[] = [
  {
    id: 'gum-health',
    parameter: 'gumInflammation',
    icon: 'gum',
    title: 'Gum health',
    healthy: 'Margins look settled.',
    watch: 'Redness along the gum line.',
  },
  {
    id: 'enamel',
    parameter: 'enamelWear',
    icon: 'enamel',
    title: 'Enamel',
    healthy: 'Strong overall · edges intact.',
    watch: 'Light wear on the front edges.',
  },
  {
    id: 'oral-tissue',
    parameter: 'tissueAppearance',
    icon: 'tissue',
    title: 'Oral tissue',
    healthy: 'No new abnormalities observed.',
    watch: 'Coating or discoloration observed.',
  },
  {
    id: 'plaque-risk',
    parameter: 'plaqueExtent',
    icon: 'plaque',
    title: 'Plaque risk',
    healthy: 'Little visible buildup.',
    watch: 'Slight buildup near the molars.',
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

    return {
      id: row.id,
      icon: row.icon,
      title: row.title,
      description: watch ? row.watch : row.healthy,
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
  { id: 'gum-inflammation', parameter: 'gumInflammation', label: 'Gum health index' },
  { id: 'plaque', parameter: 'plaqueExtent', label: 'Plaque control' },
  { id: 'depth', parameter: 'gumMarginRecession', label: 'Gum margin depth (est.)' },
  { id: 'tissue', parameter: 'tissueAppearance', label: 'Oral tissue' },
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
  return annotations.filter((annotation) => {
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
}
