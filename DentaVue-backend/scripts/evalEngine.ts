/**
 * DentaVue AI Engine Accuracy & Repeatability Evaluation Suite.
 *
 * Measures:
 *   1. Repeatability (Test-Retest Consistency): run the same photo set N times
 *      and measure score std-dev, score spread, and per-parameter band agreement.
 *   2. Rejection Gate Precision: verify non-oral or unreadable photos are cleanly
 *      rejected (isValidOralScan === false or confidence < USABLE_CONFIDENCE_FLOOR).
 *   3. Clinical Ground-Truth Benchmark (--manifest): compare predicted bands and
 *      "Watch" flags against dentist-labelled ground truth (exact band accuracy,
 *      within-±1 band accuracy, Watch sensitivity & specificity).
 *
 * Usage:
 *   npm run eval -- --repeat 3 front.jpg upper.jpg tongue.jpg lower.jpg
 *   npm run eval -- --reject-test random-desk.jpg dark-wall.jpg
 *   npm run eval -- --manifest scripts/eval-manifest.example.json
 */
import { readFile } from 'node:fs/promises'
import { basename, dirname, extname, resolve } from 'node:path'
import { env } from '@/config/env.js'
import { generateJson, isGeminiConfigured } from '@/integrations/gemini.js'
import { VISION_SYSTEM_INSTRUCTION, visionPrompt, visionSchema } from '@/integrations/geminiPrompts.js'
import {
  BANDS,
  RUBRIC_VERSION,
  bandMap,
  computeConfidence,
  computeScore,
  isReadable,
  scoreParameters,
} from '@/services/scoring.js'
import { BAND_ORDER, PARAMETERS } from '@/types/analysis.js'
import type { Band, ParameterKey, VisionResult } from '@/types/analysis.js'

const ANGLES = ['front-teeth', 'upper-gums', 'tongue', 'lower-gums'] as const

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

interface SingleRunResult {
  isValidOralScan: boolean
  isReadable: boolean
  accepted: boolean
  rejectionReason: string
  score: number
  confidence: number
  bands: Record<ParameterKey, Band>
  severities: Record<ParameterKey, number>
  latencyMs: number
  tokens: number
}

interface ManifestCase {
  id: string
  images: string[]
  expectedValid: boolean
  expectedBands?: Partial<Record<ParameterKey, Band>>
}

function usage(): never {
  console.error(`
DentaVue AI Engine Evaluation Suite (Rubric v${RUBRIC_VERSION})

Modes:
  1) Repeatability test (runs N times on the same photos):
     npm run eval -- --repeat 3 <img1> [img2] [img3] [img4]

  2) Non-oral / unreadable rejection test:
     npm run eval -- --reject-test <non-dental-img1> [img2...]

  3) Labelled ground-truth benchmark:
     npm run eval -- --manifest <path/to/manifest.json>
`)
  process.exit(1)
}

async function loadImages(files: string[]): Promise<{ mimeType: string; data: Buffer }[]> {
  return Promise.all(
    files.map(async (file) => {
      const data = await readFile(file)
      return { mimeType: MIME_BY_EXT[extname(file).toLowerCase()] ?? 'image/jpeg', data }
    }),
  )
}

async function evaluateFrameSet(files: string[]): Promise<SingleRunResult> {
  const images = await loadImages(files)
  const angles = files.map((_, idx) => ANGLES[idx] ?? `angle-${idx}`)

  const vision = await generateJson<VisionResult>({
    model: env.GEMINI_MODEL,
    fallbackModels: env.GEMINI_FALLBACK_MODELS,
    systemInstruction: VISION_SYSTEM_INSTRUCTION,
    prompt: visionPrompt(angles),
    images,
    schema: visionSchema(),
    maxOutputTokens: 2_048,
    thinkingBudget: 1536,
    mediaResolution: `MEDIA_RESOLUTION_${env.GEMINI_MEDIA_RESOLUTION}` as const,
  })

  const frameChecks = vision.data.frameChecks ?? []
  const visibleOralFrames = frameChecks.filter((f) => f.isOralCavityVisible).length
  const hasFrameChecks = frameChecks.length > 0
  const measuredQuality = hasFrameChecks
    ? frameChecks.reduce((sum, f) => sum + (f.isOralCavityVisible ? f.clarity : 0), 0) /
      frameChecks.length
    : 1

  const scored = scoreParameters(vision.data, {})
  const bands = bandMap(scored)
  const score = computeScore(bands, scored)
  const confidence = computeConfidence(vision.data.parameters, measuredQuality)
  const readable = isReadable(confidence)
  const validOral = vision.data.isValidOralScan !== false && (!hasFrameChecks || visibleOralFrames > 0)

  const severities = {} as Record<ParameterKey, number>
  for (const param of PARAMETERS) {
    severities[param] = vision.data.parameters[param].severity
  }

  return {
    isValidOralScan: validOral,
    isReadable: readable,
    accepted: validOral && readable,
    rejectionReason: vision.data.rejectionReason ?? '',
    score,
    confidence,
    bands,
    severities,
    latencyMs: vision.latencyMs,
    tokens: vision.inputTokens + vision.outputTokens,
  }
}

function bandIndex(band: Band): number {
  return BAND_ORDER.indexOf(band)
}

function isWatchBand(band: Band): boolean {
  return band === 'moderate' || band === 'marked'
}

async function runRepeatability(files: string[], runs: number): Promise<void> {
  console.log(`\n=== DentaVue Engine Repeatability Test (${runs} runs) ===`)
  console.log(`Model:  ${env.GEMINI_MODEL} (${env.GEMINI_MEDIA_RESOLUTION}) | Rubric: ${RUBRIC_VERSION}`)
  console.log(`Frames: ${files.map((f) => basename(f)).join(', ')}\n`)

  const results: SingleRunResult[] = []
  for (let i = 0; i < runs; i += 1) {
    process.stdout.write(`Run ${i + 1}/${runs}... `)
    const res = await evaluateFrameSet(files)
    results.push(res)
    console.log(
      `score=${res.score}/100  confidence=${res.confidence}%  accepted=${res.accepted}  latency=${res.latencyMs}ms`,
    )
  }

  const scores = results.map((r) => r.score)
  const meanScore = scores.reduce((a, b) => a + b, 0) / scores.length
  const variance = scores.reduce((sum, s) => sum + (s - meanScore) ** 2, 0) / scores.length
  const stdDev = Math.sqrt(variance)
  const spread = Math.max(...scores) - Math.min(...scores)

  const confs = results.map((r) => r.confidence)
  const meanConf = confs.reduce((a, b) => a + b, 0) / confs.length

  let totalAgreements = 0
  console.log('\nPer-parameter stability:')
  for (const param of PARAMETERS) {
    const counts = new Map<Band, number>()
    for (const res of results) {
      const b = res.bands[param]
      counts.set(b, (counts.get(b) ?? 0) + 1)
    }
    const maxCount = Math.max(...counts.values())
    const agreement = Math.round((maxCount / runs) * 100)
    if (maxCount === runs) totalAgreements += 1
    const dist = [...counts.entries()].map(([b, c]) => `${b}×${c}`).join(', ')
    console.log(`  - ${param.padEnd(20)} ${String(agreement).padStart(3)}% agreement  (${dist})`)
  }

  const avgLatency = Math.round(results.reduce((s, r) => s + r.latencyMs, 0) / runs)
  console.log('\n--- Summary ---')
  console.log(`Score Mean:         ${meanScore.toFixed(1)} / 100`)
  console.log(`Score Spread:       ${spread} pts (target <= 6 pts)`)
  console.log(`Score Std-Dev (σ):  ${stdDev.toFixed(2)} pts`)
  console.log(`Confidence Mean:    ${meanConf.toFixed(1)}%`)
  console.log(`100%-Stable Areas:  ${totalAgreements} / ${PARAMETERS.length}`)
  console.log(`Avg Latency:        ${avgLatency} ms`)
}

async function runRejectTest(files: string[]): Promise<void> {
  console.log(`\n=== DentaVue Non-Oral / Unreadable Rejection Gate Test (${files.length} images) ===\n`)
  let rejected = 0
  for (const file of files) {
    const res = await evaluateFrameSet([file])
    const passed = !res.accepted
    if (passed) rejected += 1
    console.log(
      `${passed ? 'PASS (Rejected)' : 'FAIL (Accepted)'}  ${basename(file).padEnd(28)} confidence=${res.confidence}%  validOral=${res.isValidOralScan}  reason="${res.rejectionReason.slice(0, 70)}"`,
    )
  }
  const rate = Math.round((rejected / files.length) * 100)
  console.log(`\nRejection Gate Accuracy: ${rejected}/${files.length} (${rate}%)`)
}

async function runManifest(manifestPath: string): Promise<void> {
  const raw = await readFile(manifestPath, 'utf8')
  const cases = JSON.parse(raw) as ManifestCase[]
  const baseDir = dirname(resolve(manifestPath))

  console.log(`\n=== DentaVue Ground-Truth Benchmark (${cases.length} cases) ===\n`)

  let gateCorrect = 0
  let exactBandHits = 0
  let adjacentBandHits = 0
  let totalBandLabels = 0
  let watchTp = 0
  let watchFp = 0
  let watchFn = 0
  let watchTn = 0

  for (const item of cases) {
    const resolvedImages = item.images.map((p) => resolve(baseDir, p))
    const res = await evaluateFrameSet(resolvedImages)
    const gateOk = res.accepted === item.expectedValid
    if (gateOk) gateCorrect += 1

    console.log(
      `[${item.id}] gate=${gateOk ? 'PASS' : 'FAIL'} (expected=${item.expectedValid}, got=${res.accepted}) score=${res.score} conf=${res.confidence}%`,
    )

    if (item.expectedValid && res.accepted && item.expectedBands) {
      for (const [param, expectedBand] of Object.entries(item.expectedBands) as [
        ParameterKey,
        Band,
      ][]) {
        const predicted = res.bands[param]
        totalBandLabels += 1
        const diff = Math.abs(bandIndex(predicted) - bandIndex(expectedBand))
        if (diff === 0) exactBandHits += 1
        if (diff <= 1) adjacentBandHits += 1

        const expWatch = isWatchBand(expectedBand)
        const predWatch = isWatchBand(predicted)
        if (expWatch && predWatch) watchTp += 1
        else if (!expWatch && predWatch) watchFp += 1
        else if (expWatch && !predWatch) watchFn += 1
        else watchTn += 1
      }
    }
  }

  console.log('\n--- Benchmark Results ---')
  console.log(
    `Oral Gate Accuracy:        ${gateCorrect}/${cases.length} (${Math.round((gateCorrect / cases.length) * 100)}%)`,
  )
  if (totalBandLabels > 0) {
    const exactPct = ((exactBandHits / totalBandLabels) * 100).toFixed(1)
    const adjPct = ((adjacentBandHits / totalBandLabels) * 100).toFixed(1)
    const sens = watchTp + watchFn > 0 ? ((watchTp / (watchTp + watchFn)) * 100).toFixed(1) : 'N/A'
    const spec = watchTn + watchFp > 0 ? ((watchTn / (watchTn + watchFp)) * 100).toFixed(1) : 'N/A'
    console.log(`Exact Band Accuracy:       ${exactBandHits}/${totalBandLabels} (${exactPct}%)`)
    console.log(`Within ±1 Band Accuracy:   ${adjacentBandHits}/${totalBandLabels} (${adjPct}%)`)
    console.log(`Watch Flag Sensitivity:    ${sens}% (catching moderate/marked issues)`)
    console.log(`Watch Flag Specificity:    ${spec}% (avoiding false alarms)`)
  }
  console.log(`Band definitions:          ${BANDS.map((b) => `${b.band}[${b.min}-${b.max}]`).join(' ')}`)
}

async function main(): Promise<void> {
  if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set in DentaVue-backend/.env')
    process.exit(1)
  }

  const args = process.argv.slice(2)
  if (args.length === 0) usage()

  const manifestIdx = args.indexOf('--manifest')
  if (manifestIdx !== -1) {
    const manifestPath = args[manifestIdx + 1]
    if (!manifestPath) usage()
    await runManifest(manifestPath)
    return
  }

  if (args.includes('--reject-test')) {
    const files = args.filter((a) => !a.startsWith('--'))
    if (files.length === 0) usage()
    await runRejectTest(files)
    return
  }

  const repeatIdx = args.indexOf('--repeat')
  const runs = repeatIdx !== -1 ? Number.parseInt(args[repeatIdx + 1] ?? '3', 10) || 3 : 3
  const files = args.filter((a, idx) => !a.startsWith('--') && idx !== repeatIdx + 1)
  if (files.length === 0 || files.length > 4) usage()

  await runRepeatability(files, runs)
}

main().catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
