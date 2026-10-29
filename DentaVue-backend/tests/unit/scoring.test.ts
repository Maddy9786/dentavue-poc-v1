import { describe, expect, it } from 'vitest'
import {
  BANDS,
  CONFIDENCE_FLOOR,
  DELTA_DEADBAND,
  HYSTERESIS_MARGIN,
  PARAMETER_WEIGHTS,
  USABLE_CONFIDENCE_FLOOR,
  approximateDepth,
  bandFor,
  bandMap,
  bandWithHysteresis,
  computeConfidence,
  computeScore,
  deriveComparison,
  deriveGlance,
  deriveRisk,
  isReadable,
  parameterIndex,
  scoreDelta,
  scoreParameters,
  validAnnotations,
} from '@/services/scoring.js'
import { PARAMETERS } from '@/types/analysis.js'
import type { Annotation, Band, ParameterKey, VisionResult } from '@/types/analysis.js'

/**
 * scoring.ts is the module that makes the product's numbers trustworthy, so it
 * is the module that has to be provably right. It is pure — no network, no
 * database, no model, no clock — which is what lets this file pin every rule
 * exhaustively without an API key or a Supabase project.
 *
 * The rules under test, and why each exists:
 *   BANDS      absorb ordinary model jitter (±8) so it changes nothing
 *   HYSTERESIS stops a reading flapping across a boundary between scans
 *   DEADBAND   stops 1-2 points of noise being presented as progress
 * Break any of them and the app reports changes the user never had.
 */

/** A vision result with every parameter at the same severity/confidence. */
const uniform = (severity: number, confidence = 0.9): VisionResult => {
  const parameters = {} as VisionResult['parameters']
  for (const parameter of PARAMETERS) {
    parameters[parameter] = { severity, confidence, regions: [] }
  }
  return { parameters, annotations: [], observations: [] }
}

const allBands = (band: Band): Record<ParameterKey, Band> => {
  const bands = {} as Record<ParameterKey, Band>
  for (const parameter of PARAMETERS) bands[parameter] = band
  return bands
}

describe('weights', () => {
  it('sum to 100 so a weight reads as "percent of the score this can cost"', () => {
    const total = PARAMETERS.reduce((sum, parameter) => sum + PARAMETER_WEIGHTS[parameter], 0)
    expect(total).toBe(100)
  })

  it('covers every parameter — a missing weight would silently score as zero', () => {
    for (const parameter of PARAMETERS) {
      expect(PARAMETER_WEIGHTS[parameter]).toBeGreaterThan(0)
    }
  })
})

describe('bandFor', () => {
  it('maps each band boundary exactly', () => {
    expect(bandFor(0)).toBe('none')
    expect(bandFor(14)).toBe('none')
    expect(bandFor(15)).toBe('mild')
    expect(bandFor(39)).toBe('mild')
    expect(bandFor(40)).toBe('moderate')
    expect(bandFor(69)).toBe('moderate')
    expect(bandFor(70)).toBe('marked')
    expect(bandFor(100)).toBe('marked')
  })

  it('clamps out-of-range severities rather than returning undefined', () => {
    expect(bandFor(-20)).toBe('none')
    expect(bandFor(999)).toBe('marked')
  })

  it('leaves no gap between bands', () => {
    for (let index = 0; index < BANDS.length - 1; index += 1) {
      expect(BANDS[index + 1]!.min).toBe(BANDS[index]!.max + 1)
    }
  })

  it('absorbs ordinary model jitter — the whole point of banding', () => {
    // A reading that drifts 27 → 34 between runs must not change anything.
    expect(bandFor(27)).toBe(bandFor(34))
  })
})

describe('bandWithHysteresis', () => {
  it('uses the raw band on a first scan, with nothing to be sticky about', () => {
    expect(bandWithHysteresis(41, null)).toBe('moderate')
  })

  it('surfaces a WORSENING immediately — no margin, quick to flag', () => {
    // Previously mild (15-39). The moment the reading enters moderate (40+) it
    // shows moderate, even by a single point — a health tool must not sit on a
    // worsening (this is the "45 held at mild → Healthy" bug, fixed).
    expect(bandWithHysteresis(40, 'mild')).toBe('moderate')
    expect(bandWithHysteresis(41, 'mild')).toBe('moderate')
    expect(bandWithHysteresis(45, 'mild')).toBe('moderate')
  })

  it('damps an IMPROVEMENT until the boundary is cleared by the margin', () => {
    // Previously moderate (min 40), so it must fall to 40 - 6 = 34 to drop to
    // mild — a small dip is not presented as progress that has not happened.
    expect(bandWithHysteresis(38, 'moderate')).toBe('moderate')
    expect(bandWithHysteresis(35, 'moderate')).toBe('moderate')
    expect(bandWithHysteresis(34, 'moderate')).toBe('mild')
  })

  it('does not block a genuine multi-band jump', () => {
    expect(bandWithHysteresis(95, 'mild')).toBe('marked')
  })

  it('never flaps: worsening sets a new floor that a small dip cannot undo', () => {
    // Worsening is immediate, improving needs the margin, so a value oscillating
    // around a boundary settles at the worse band rather than bouncing.
    let band: Band = 'mild'
    for (const severity of [40, 38, 41, 39, 42, 40]) {
      band = bandWithHysteresis(severity, band)
    }
    expect(band).toBe('moderate')
  })

  it('uses the margin only on the improving side', () => {
    const moderateMin = BANDS.find((entry) => entry.band === 'moderate')!.min
    // Worsening: no margin — moderateMin itself already escalates.
    expect(bandWithHysteresis(moderateMin, 'mild')).toBe('moderate')
    // Improving: the margin applies — moderateMin - margin + 1 still holds.
    expect(bandWithHysteresis(moderateMin - HYSTERESIS_MARGIN + 1, 'moderate')).toBe('moderate')
    expect(bandWithHysteresis(moderateMin - HYSTERESIS_MARGIN, 'moderate')).toBe('mild')
  })
})

describe('computeScore', () => {
  it('gives a clean mouth 100', () => {
    expect(computeScore(allBands('none'))).toBe(100)
  })

  it('produces the documented reference curve', () => {
    expect(computeScore(allBands('mild'))).toBe(100 - 25)
    expect(computeScore(allBands('moderate'))).toBe(100 - 55)
    expect(computeScore(allBands('marked'))).toBe(100 - 85)
  })

  it('matches the worked example in AI_INTEGRATION.md', () => {
    const bands = allBands('none')
    bands.gumInflammation = 'mild'
    bands.plaqueExtent = 'mild'
    bands.gumMarginRecession = 'mild'
    bands.calculusStain = 'mild'
    // 6.25 + 5 + 5 + 1.25 = 17.5 penalty → 82.5, rounded half-up.
    expect(computeScore(bands)).toBe(83)
  })

  it('weights parameters by their documented importance', () => {
    const inflamed = allBands('none')
    inflamed.gumInflammation = 'marked'
    const stained = allBands('none')
    stained.calculusStain = 'marked'
    // Inflammation is weighted 25, staining 5 — it must cost far more.
    expect(computeScore(inflamed)).toBeLessThan(computeScore(stained))
  })

  it('stays within 0-100 at the extremes', () => {
    expect(computeScore(allBands('marked'))).toBeGreaterThanOrEqual(0)
    expect(computeScore(allBands('none'))).toBeLessThanOrEqual(100)
  })

  it('is deterministic — the same bands always give the same score', () => {
    const bands = allBands('moderate')
    expect(computeScore(bands)).toBe(computeScore(bands))
  })
})

describe('computeConfidence', () => {
  it('is high when the model was sure and the capture was good', () => {
    expect(computeConfidence(uniform(20, 0.95).parameters, 1)).toBeGreaterThan(CONFIDENCE_FLOOR)
  })

  it('falls below the floor when the model could barely see', () => {
    expect(computeConfidence(uniform(20, 0.2).parameters, 0.4)).toBeLessThan(CONFIDENCE_FLOOR)
  })

  it('penalises each parameter the model flagged uncertain', () => {
    const mixed = uniform(20, 0.9)
    mixed.parameters.tissueAppearance.confidence = 0.1
    expect(computeConfidence(mixed.parameters, 1)).toBeLessThan(
      computeConfidence(uniform(20, 0.9).parameters, 1),
    )
  })

  it('does not punish an un-gated capture — quality defaults to 1', () => {
    expect(computeConfidence(uniform(20, 0.9).parameters)).toBeGreaterThan(CONFIDENCE_FLOOR)
  })

  it('stays within 0-100 even when everything is terrible', () => {
    const value = computeConfidence(uniform(20, 0).parameters, 0)
    expect(value).toBeGreaterThanOrEqual(0)
    expect(value).toBeLessThanOrEqual(100)
  })
})

describe('isReadable', () => {
  it('brackets sits below the provisional floor', () => {
    // Unreadable is a stricter gate than provisional: a scan can be readable but
    // still provisional (40-59), never the reverse.
    expect(USABLE_CONFIDENCE_FLOOR).toBeLessThan(CONFIDENCE_FLOOR)
  })

  it('rejects a capture the model could barely see', () => {
    // A distant selfie with no teeth reads ~16-28 in real runs.
    const confidence = computeConfidence(uniform(5, 0.1).parameters)
    expect(confidence).toBeLessThan(USABLE_CONFIDENCE_FLOOR)
    expect(isReadable(confidence)).toBe(false)
  })

  it('keeps a proper close-up', () => {
    // A real mouth photographed well reads 90+ in real runs.
    const confidence = computeConfidence(uniform(20, 0.9).parameters)
    expect(confidence).toBeGreaterThanOrEqual(USABLE_CONFIDENCE_FLOOR)
    expect(isReadable(confidence)).toBe(true)
  })

  it('keeps a dim-but-usable capture rather than over-rejecting', () => {
    // Model moderately unsure but not blind — provisional, still readable.
    const confidence = computeConfidence(uniform(20, 0.55).parameters)
    expect(isReadable(confidence)).toBe(true)
  })
})

describe('scoreDelta', () => {
  it('reports nothing on a first scan', () => {
    expect(scoreDelta(82, null)).toEqual({ points: 0, direction: 'stable' })
  })

  it('suppresses noise below the deadband', () => {
    expect(scoreDelta(82, 80).direction).toBe('stable')
    expect(scoreDelta(80, 82).direction).toBe('stable')
  })

  it('reports a change that clears the deadband', () => {
    expect(scoreDelta(85, 80)).toEqual({ points: 5, direction: 'up' })
    expect(scoreDelta(75, 80)).toEqual({ points: 5, direction: 'down' })
  })

  it('treats the deadband boundary as reportable', () => {
    expect(scoreDelta(80 + DELTA_DEADBAND, 80).direction).toBe('up')
    expect(scoreDelta(80 + DELTA_DEADBAND - 1, 80).direction).toBe('stable')
  })

  it('reports nothing at all when the scan is provisional', () => {
    // We could not see well enough to trust it; a "change" here would be noise.
    expect(scoreDelta(95, 70, true)).toEqual({ points: 0, direction: 'stable' })
  })
})

describe('scoreParameters', () => {
  it('returns every parameter in a stable order', () => {
    const scored = scoreParameters(uniform(30))
    expect(scored.map((entry) => entry.parameter)).toEqual([...PARAMETERS])
  })

  it('keeps the raw severity for audit and re-scoring', () => {
    expect(scoreParameters(uniform(37))[0]!.severity).toBe(37)
  })

  it('converts the model confidence from 0-1 to 0-100', () => {
    expect(scoreParameters(uniform(30, 0.82))[0]!.confidence).toBe(82)
  })

  it('damps an improvement against the previous scan, but not a worsening', () => {
    // 38 is mild on its own. With a previous 'moderate' it is an IMPROVEMENT, so
    // hysteresis holds it at moderate (must fall to 34 to drop); with no history
    // it is plainly mild. Same severity, different history.
    const improving: Partial<Record<ParameterKey, Band>> = { gumInflammation: 'moderate' }
    const scored = scoreParameters(uniform(38), improving)
    const gum = scored.find((entry) => entry.parameter === 'gumInflammation')!
    const other = scored.find((entry) => entry.parameter === 'plaqueExtent')!
    expect(gum.band).toBe('moderate')
    expect(other.band).toBe('mild')

    // A worsening is never damped: 41 with a previous 'mild' shows moderate at once.
    const worsening: Partial<Record<ParameterKey, Band>> = { gumInflammation: 'mild' }
    const escalated = scoreParameters(uniform(41), worsening).find(
      (entry) => entry.parameter === 'gumInflammation',
    )!
    expect(escalated.band).toBe('moderate')
  })

  it('clamps a severity the model returned out of range', () => {
    const rogue = uniform(30)
    rogue.parameters.enamelWear.severity = 900
    const scored = scoreParameters(rogue)
    expect(scored.find((entry) => entry.parameter === 'enamelWear')!.severity).toBe(100)
  })
})

describe('deriveRisk', () => {
  it('maps bands onto the screen levels — one per band, so it actually varies', () => {
    expect(deriveRisk(scoreParameters(uniform(5)))[0]!.level).toBe('Low')
    expect(deriveRisk(scoreParameters(uniform(30)))[0]!.level).toBe('Mild')
    expect(deriveRisk(scoreParameters(uniform(50)))[0]!.level).toBe('Medium')
    expect(deriveRisk(scoreParameters(uniform(80)))[0]!.level).toBe('Attention')
  })

  it('flags the attention tone only at the top band', () => {
    expect(deriveRisk(scoreParameters(uniform(50)))[0]!.tone).toBe('good')
    expect(deriveRisk(scoreParameters(uniform(80)))[0]!.tone).toBe('attention')
  })

  it('appends the regions the model actually named', () => {
    const vision = uniform(50)
    vision.parameters.gumInflammation.regions = ['lower-left margin']
    const row = deriveRisk(scoreParameters(vision), vision).find(
      (entry) => entry.id === 'gum-inflammation',
    )!
    expect(row.detail).toContain('lower-left margin')
  })

  it('returns one row per tracked area', () => {
    expect(deriveRisk(scoreParameters(uniform(20)))).toHaveLength(4)
  })
})

describe('deriveGlance', () => {
  it('says Watch once a parameter reaches moderate', () => {
    const gum = deriveGlance(scoreParameters(uniform(50))).find((entry) => entry.id === 'gum-health')!
    expect(gum.status).toBe('Watch')
    expect(gum.tone).toBe('watch')
  })

  it('prefers the trend when there is a real improvement', () => {
    const previous = allBands('moderate')
    const gum = deriveGlance(scoreParameters(uniform(20)), previous).find(
      (entry) => entry.id === 'gum-health',
    )!
    expect(gum.status).toBe('Improving')
  })

  it('keeps the watch tone even while improving — still worth watching', () => {
    const previous = allBands('marked')
    const gum = deriveGlance(scoreParameters(uniform(50)), previous).find(
      (entry) => entry.id === 'gum-health',
    )!
    expect(gum.status).toBe('Improving')
    expect(gum.tone).toBe('watch')
  })

  it('reports stable with no previous scan', () => {
    expect(deriveGlance(scoreParameters(uniform(20)))[0]!.trend).toBe('stable')
  })

  it('suppresses every trend when the scan is provisional', () => {
    const previous = allBands('marked')
    const glance = deriveGlance(scoreParameters(uniform(10)), previous, true)
    expect(glance.every((entry) => entry.trend === 'stable')).toBe(true)
    expect(glance.every((entry) => entry.status !== 'Improving')).toBe(true)
  })
})

describe('deriveComparison', () => {
  it('derives the badge from the delta — it is never chosen', () => {
    const worse = deriveComparison(allBands('mild'), allBands('marked'))
    expect(worse.every((metric) => metric.badge === 'Needs Attention')).toBe(true)

    const better = deriveComparison(allBands('marked'), allBands('mild'))
    expect(better.every((metric) => metric.badge === 'Improving')).toBe(true)
  })

  it('cannot produce the mock data contradiction (Mild → Marked labelled Stable)', () => {
    const metrics = deriveComparison(allBands('mild'), allBands('marked'))
    expect(metrics.some((metric) => metric.badge === 'Stable')).toBe(false)
  })

  it('reports stable when nothing moved', () => {
    const metrics = deriveComparison(allBands('mild'), allBands('mild'))
    expect(metrics.every((metric) => metric.tone === 'stable')).toBe(true)
  })

  it('renders the depth row as an approximate measurement', () => {
    const depth = deriveComparison(allBands('none'), allBands('moderate')).find(
      (metric) => metric.id === 'depth',
    )!
    expect(depth.from).toBe('~1 mm')
    expect(depth.to).toBe('~3 mm')
    expect(depth.label).toContain('est.')
  })

  it('renders the non-depth rows as a numeric health index (100 = clear)', () => {
    const metrics = deriveComparison(allBands('none'), allBands('mild'))
    const gum = metrics.find((metric) => metric.id === 'gum-inflammation')!
    // none → 100 (clear), mild → 75. A number the screen shows, not a band word.
    expect(gum.from).toBe('100')
    expect(gum.to).toBe('75')
    expect(gum.label).toBe('Gum health index')
    // The index moves the same direction as health: worse band → lower number.
    expect(Number(gum.to)).toBeLessThan(Number(gum.from))
  })
})

describe('parameterIndex', () => {
  it('is 100 for a clear parameter and falls with severity', () => {
    expect(parameterIndex('none')).toBe(100)
    expect(parameterIndex('mild')).toBe(75)
    expect(parameterIndex('moderate')).toBe(45)
    expect(parameterIndex('marked')).toBe(15)
  })

  it('decreases monotonically as the band worsens', () => {
    expect(parameterIndex('none')).toBeGreaterThan(parameterIndex('mild'))
    expect(parameterIndex('mild')).toBeGreaterThan(parameterIndex('moderate'))
    expect(parameterIndex('moderate')).toBeGreaterThan(parameterIndex('marked'))
  })
})

describe('approximateDepth', () => {
  it('always carries the tilde and never a decimal', () => {
    for (const band of ['none', 'mild', 'moderate', 'marked'] as Band[]) {
      const value = approximateDepth(band)
      expect(value.startsWith('~')).toBe(true)
      expect(value).not.toMatch(/\d\.\d/)
    }
  })

  it('increases monotonically with the band', () => {
    const numeric = (band: Band) => Number.parseInt(approximateDepth(band).replace(/\D/g, ''), 10)
    expect(numeric('none')).toBeLessThan(numeric('mild'))
    expect(numeric('mild')).toBeLessThan(numeric('moderate'))
    expect(numeric('moderate')).toBeLessThan(numeric('marked'))
  })
})

describe('validAnnotations', () => {
  const box = (over: Partial<Annotation> = {}): Annotation => ({
    position: 0,
    parameter: 'gumInflammation',
    box: [100, 100, 200, 200],
    label: 'redness',
    ...over,
  })

  it('keeps a well-formed box', () => {
    expect(validAnnotations([box()], 4)).toHaveLength(1)
  })

  it('drops a box on a frame that was not captured', () => {
    expect(validAnnotations([box({ position: 3 })], 2)).toHaveLength(0)
  })

  it('drops an inverted box', () => {
    expect(validAnnotations([box({ box: [200, 200, 100, 100] })], 4)).toHaveLength(0)
  })

  it('drops a box outside the normalised range', () => {
    expect(validAnnotations([box({ box: [0, 0, 5000, 5000] })], 4)).toHaveLength(0)
  })

  it('drops a zero-area box', () => {
    expect(validAnnotations([box({ box: [100, 100, 100, 200] })], 4)).toHaveLength(0)
  })
})

describe('bandMap', () => {
  it('round-trips through scoreParameters', () => {
    const map = bandMap(scoreParameters(uniform(50)))
    expect(PARAMETERS.every((parameter) => map[parameter] === 'moderate')).toBe(true)
  })

  it('defaults a missing parameter to none rather than throwing', () => {
    expect(bandMap([])[PARAMETERS[0]]).toBe('none')
  })
})
