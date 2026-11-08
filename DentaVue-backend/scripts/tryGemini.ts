/**
 * Try the scan-analysis pipeline against real photos, from the command line.
 *
 *   npm run try:gemini -- front.jpg upper.jpg tongue.jpg lower.jpg
 *   npm run try:gemini -- --narrative front.jpg upper.jpg tongue.jpg lower.jpg
 *
 * WHY THIS EXISTS. Google AI Studio's structured-output toggle is greyed out for
 * some model/tool combinations, which makes it impossible to test the thing that
 * matters most — the response schema is what stops the model inventing a score.
 * This script has no such problem: it calls the SAME integration module, with the
 * SAME prompts and schema, and then runs the result through the SAME scoring
 * rubric the app uses. If it works here, it works in the app.
 *
 * It needs GEMINI_API_KEY in .env. It does NOT touch Supabase or the database —
 * images are read from disk, nothing is uploaded, nothing is persisted. Safe to
 * run against a throwaway photo as often as you like.
 *
 * Run it twice on the same images to see the drift the scoring layer absorbs;
 * that is the most informative thing this script does.
 */
import { readFile } from 'node:fs/promises'
import { basename, extname } from 'node:path'
import { env } from '@/config/env.js'
import { generateJson, isGeminiConfigured } from '@/integrations/gemini.js'
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
  approximateDepth,
  bandMap,
  computeConfidence,
  computeScore,
  deriveGlance,
  deriveRisk,
  scoreParameters,
  validAnnotations,
} from '@/services/scoring.js'
import { PARAMETERS } from '@/types/analysis.js'
import type { NarrativeDto, VisionResult } from '@/types/analysis.js'

// The capture order the app uses. Extra files fall back to a positional name.
const ANGLES = ['front-teeth', 'upper-gums', 'tongue', 'lower-gums'] as const

const MIME_BY_EXT: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

function usage(): never {
  console.error(`
Usage: npm run try:gemini -- [--narrative] <image...>

  <image...>     1-4 photos, in capture order:
                 front teeth, upper gums, tongue, lower gums
  --narrative    also run pass 2 (the prose), given the computed bands

Example:
  npm run try:gemini -- ~/scans/front.jpg ~/scans/upper.jpg
`)
  process.exit(1)
}

async function main(): Promise<void> {
  const args = process.argv.slice(2)
  const withNarrative = args.includes('--narrative')
  const files = args.filter((arg) => !arg.startsWith('--'))

  if (files.length === 0) usage()
  if (files.length > 4) {
    console.error('At most 4 images (the app captures four angles).')
    process.exit(1)
  }
  if (!isGeminiConfigured()) {
    console.error('GEMINI_API_KEY is not set. Add it to DentaVue-backend/.env')
    process.exit(1)
  }

  const images = await Promise.all(
    files.map(async (file) => {
      const data = await readFile(file).catch(() => {
        console.error(`Could not read ${file}`)
        process.exit(1)
      })
      return { mimeType: MIME_BY_EXT[extname(file).toLowerCase()] ?? 'image/jpeg', data }
    }),
  )

  const angles = files.map((file, index) => ANGLES[index] ?? `angle-${index}`)
  console.log(`\nModel:  ${env.GEMINI_MODEL}  (media resolution ${env.GEMINI_MEDIA_RESOLUTION})`)
  console.log(`Rubric: ${RUBRIC_VERSION}`)
  console.log(`Frames: ${files.map((file, i) => `${i}=${basename(file)}`).join('  ')}\n`)
  console.log('Running pass 1 (vision)…')

  const vision = await generateJson<VisionResult>({
    model: env.GEMINI_MODEL,
    fallbackModels: env.GEMINI_FALLBACK_MODELS,
    systemInstruction: VISION_SYSTEM_INSTRUCTION,
    prompt: visionPrompt(angles),
    images,
    schema: visionSchema(),
    maxOutputTokens: 2_048,
    thinkingBudget: 512,
    mediaResolution: `MEDIA_RESOLUTION_${env.GEMINI_MEDIA_RESOLUTION}` as const,
  })

  console.log(
    `  ${vision.latencyMs} ms · ${vision.inputTokens} in / ${vision.outputTokens} out ` +
      `(${vision.thoughtTokens} of it reasoning)` +
      `${vision.model !== env.GEMINI_MODEL ? `  · fell back to ${vision.model}` : ''}\n`,
  )

  // --- What the model said (raw, pre-band) ---------------------------------
  console.log('RAW MODEL OUTPUT — never rendered, stored for audit only')
  console.log('  parameter             severity  confidence  regions')
  for (const parameter of PARAMETERS) {
    const observation = vision.data.parameters[parameter]
    console.log(
      `  ${parameter.padEnd(20)}  ${String(observation.severity).padStart(8)}  ` +
        `${observation.confidence.toFixed(2).padStart(10)}  ${observation.regions.join(', ')}`,
    )
  }

  // --- What the backend decides --------------------------------------------
  // No previous scan on the command line, so hysteresis has nothing to hold
  // against — bands here are the raw bands. In the app, a second scan of the
  // same mouth would be stickier than this.
  const scored = scoreParameters(vision.data)
  const bands = bandMap(scored)
  const score = computeScore(bands)
  const confidence = computeConfidence(vision.data.parameters)
  const provisional = confidence < CONFIDENCE_FLOOR

  console.log('\nBACKEND-COMPUTED — this is what the app shows')
  console.log('  parameter             band')
  for (const parameter of scored) {
    console.log(`  ${parameter.parameter.padEnd(20)}  ${parameter.band}`)
  }
  console.log(`\n  Score        ${score}/100`)
  console.log(`  Confidence   ${confidence}%${provisional ? '  ← PROVISIONAL (deltas suppressed)' : ''}`)
  console.log(`  Depth (est.) ${approximateDepth(bands.gumMarginRecession)}`)

  console.log('\n  Risk assessment screen:')
  for (const item of deriveRisk(scored, vision.data)) {
    console.log(`    ${item.level.padEnd(10)} ${item.title} — ${item.detail}`)
  }

  console.log('\n  At a glance:')
  for (const item of deriveGlance(scored, {}, provisional)) {
    console.log(`    ${item.status.padEnd(10)} ${item.title} — ${item.description}`)
  }

  const annotations = validAnnotations(vision.data.annotations ?? [], files.length)
  const dropped = (vision.data.annotations ?? []).length - annotations.length
  console.log(`\n  Annotations: ${annotations.length} kept${dropped > 0 ? `, ${dropped} dropped as malformed` : ''}`)
  for (const annotation of annotations) {
    const [yMin, xMin, yMax, xMax] = annotation.box
    console.log(
      `    frame ${annotation.position}  [${yMin},${xMin},${yMax},${xMax}]  ` +
        `→ top ${(yMin / 10).toFixed(1)}% left ${(xMin / 10).toFixed(1)}% ` +
        `h ${((yMax - yMin) / 10).toFixed(1)}% w ${((xMax - xMin) / 10).toFixed(1)}%  ${annotation.label}`,
    )
  }

  if (vision.data.observations?.length) {
    console.log('\n  Observations:')
    for (const observation of vision.data.observations) console.log(`    - ${observation}`)
  }

  // --- Pass 2 ---------------------------------------------------------------
  if (withNarrative) {
    console.log('\nRunning pass 2 (narrative, text only)…')
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
        trend: 'stable',
        isFirstScan: true,
      }),
      schema: narrativeSchema(),
      maxOutputTokens: 1_536,
      thinkingBudget: 0,
    })
    console.log(
      `  ${written.latencyMs} ms · ${written.inputTokens} in / ${written.outputTokens} out ` +
        `(${written.thoughtTokens} of it reasoning)\n`,
    )
    console.log(
      `  Billed this run: ${vision.inputTokens + written.inputTokens} in / ` +
        `${vision.outputTokens + written.outputTokens} out tokens\n`,
    )
    console.log(JSON.stringify(written.data, null, 2))

    // The rule pass 2 most often breaks. Worth flagging loudly rather than
    // leaving someone to notice it in the UI later.
    const prose = JSON.stringify(written.data)
    if (/\d/.test(prose.replace(/"(icon|status)":"[^"]*"/g, ''))) {
      console.log(
        '\n  ⚠ The prose contains digits. Pass 2 must not state numbers — the app ' +
          'displays those itself, and a model-invented figure will disagree with the score.',
      )
    }
  }

  console.log('\nRun this again on the same images: severities will drift a few points.')
  console.log('That drift is what the bands absorb — which is the whole point of scoring.ts.\n')
}

await main()
