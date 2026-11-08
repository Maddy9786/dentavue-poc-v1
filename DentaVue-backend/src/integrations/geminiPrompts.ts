import { PARAMETERS, type ParameterKey } from '@/types/analysis.js'
import type { ResponseSchema } from '@/integrations/gemini.js'

/**
 * Prompts and response schemas for the two analysis passes.
 *
 * Kept separate from the transport in gemini.ts so the wording — which is the
 * part with product and safety consequences — can be reviewed, diffed and
 * versioned without wading through fetch plumbing.
 *
 * THE NON-DIAGNOSTIC CONSTRAINT IS ENFORCED TWICE, on purpose:
 *   1. Structurally — the vision schema has no field for a diagnosis, a score,
 *      a band or a condition name. A model cannot return what the schema will
 *      not decode, so a careless prompt edit cannot open that door.
 *   2. In wording — the system instructions below say it in plain terms.
 * Belt and braces, because the project's scoping decision (current VLMs miss
 * micro-calcifications and early enamel changes) is the whole reason this
 * feature is allowed to ship at all. See AI_INTEGRATION.md.
 */

/** What each parameter means, in the model's terms. Order matches PARAMETERS. */
const PARAMETER_GUIDE: Record<ParameterKey, string> = {
  gumInflammation:
    'Redness, puffiness or swelling along the gum margins. 0 = uniformly pale pink and flat; 100 = deep red and visibly swollen. Judge by the WORST margin visible in any frame, not the average — one clearly inflamed area is a real finding even if the rest look healthy.',
  plaqueExtent:
    'Visible soft deposits and biofilm — dull white/yellow film, especially at the gum line. 0 = none visible; 100 = heavy film across most visible surfaces.',
  gumMarginRecession:
    'Gum margin position: root exposure, scalloping, margins sitting lower than neighbouring teeth. 0 = margins even and high; 100 = pronounced exposure on several teeth.',
  enamelWear:
    'Edge translucency, chipping, flattened biting edges, a broken or jagged tooth edge, surface dullness. 0 = edges opaque and intact; 100 = a clearly broken/chipped tooth or marked translucency.',
  tissueAppearance:
    'Soft tissue: tongue coating, ulcers, unusual patches or discoloration on tongue, palate and cheeks. 0 = evenly pink, no coating; 100 = a large ulcer/patch or heavy coating. Score by the most affected area — a single distinct lesion is a real finding.',
  calculusStain:
    'Hard deposits (tartar) and extrinsic staining. 0 = none; 100 = substantial deposits or heavy staining across many teeth.',
}

/**
 * Pass 1 system instruction.
 *
 * Two things it must achieve: a calibrated severity scale (so the same mouth
 * lands in the same band twice), and a hard stop on clinical language. The
 * "when unsure, report lower confidence rather than guessing a severity"
 * instruction matters — an uncertain guess with high confidence is the input
 * the scoring layer cannot defend against.
 */
export const VISION_SYSTEM_INSTRUCTION = `You are an image-observation component in a dental WELLNESS app. You describe what is visible in photographs of a mouth. You are NOT a diagnostic system.

Absolute rules:
- Never name, suggest or imply a disease, condition or diagnosis (no "gingivitis", "periodontitis", "caries", "decay", "infection", "oral cancer").
- Never recommend treatment.
- Report only what is VISIBLE in the photographs. Never infer anything that requires an instrument, an X-ray or a clinical examination — you cannot measure pocket depth, tooth mobility, or anything beneath the surface.
- If an area is not visible, poorly lit, blurred or out of frame, report LOW confidence for the parameters that depend on it. Never compensate by guessing.

Severity calibration:
- Severity is 0-100. 0 = "nothing of this kind is visible"; 100 = "severe and unmistakable".
- Score each parameter by the WORST-AFFECTED area you can see in ANY single frame — do NOT average across frames. If one frame shows deep-red, swollen gums and the others look healthy, gum inflammation is HIGH. Averaging a clear problem away against calmer frames is the failure to avoid.
- Bands to aim for: 0-14 nothing/negligible · 15-39 mild but clearly present · 40-69 moderate and obvious · 70-100 severe and unmistakable. A vivid, obvious problem in even one area — bright-red swollen gums, a large ulcer or patch, a broken or jagged tooth — belongs at 70 or above.
- The balance: obvious problems must NOT be under-called, and faint or borderline findings on an otherwise healthy mouth must NOT be over-called. A normal, well-kept mouth still sits between 5 and 30 on most parameters.

Confidence is 0.0-1.0 and reflects how well you could SEE the thing, not how bad it is.`

/**
 * Pass 1 user prompt. The four frames are described by position so the model
 * can attribute annotations to the right image.
 */
export function visionPrompt(angles: string[]): string {
  const frames = angles
    .map((angle, index) => `  ${index}: ${angle.replace(/-/g, ' ')}`)
    .join('\n')

  const guide = PARAMETERS.map((parameter) => `- ${parameter}: ${PARAMETER_GUIDE[parameter]}`).join(
    '\n',
  )

  return `Assess these ${angles.length} photographs of one person's mouth, captured in this order:

${frames}

Report a severity and confidence for each of these parameters:

${guide}

For "regions", use short plain-language locations you can actually see, such as "lower-left margin", "upper front teeth", "tongue centre". Use an empty list if the parameter is not visibly present anywhere.

Also return "annotations": the specific areas that evidence a parameter, so they can be highlighted for the user. Give each a bounding box in normalised coordinates 0-1000 as [y_min, x_min, y_max, x_max], the frame index it belongs to, the parameter it evidences, and a short label. Only annotate what you can clearly see — return an empty list rather than a speculative box. Annotate at most 6 regions in total, the clearest ones.

Finally return "observations": up to 4 short, factual, neutral sentences describing what is visible. No numbers, no conditions, no advice.`
}

/**
 * Pass 1 response schema.
 *
 * NOTE WHAT IS ABSENT: no score, no band, no level, no badge, no trend, no
 * millimetre, no condition name. Those are computed by scoring.ts. Gemini
 * constrains decoding to this schema, so the model physically cannot return
 * them — that is the guarantee, not the prompt wording.
 */
export function visionSchema(): ResponseSchema {
  const observation: ResponseSchema = {
    type: 'object',
    properties: {
      severity: { type: 'integer', minimum: 0, maximum: 100, description: '0-100, higher is worse' },
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'How well you could see it' },
      regions: { type: 'array', items: { type: 'string' } },
    },
    required: ['severity', 'confidence', 'regions'],
    propertyOrdering: ['severity', 'confidence', 'regions'],
  }

  const parameters: Record<string, ResponseSchema> = {}
  for (const parameter of PARAMETERS) parameters[parameter] = observation

  return {
    type: 'object',
    properties: {
      parameters: {
        type: 'object',
        properties: parameters,
        required: [...PARAMETERS],
        propertyOrdering: [...PARAMETERS],
      },
      annotations: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position: { type: 'integer', minimum: 0, maximum: 3 },
            parameter: { type: 'string', enum: [...PARAMETERS] },
            box: {
              type: 'array',
              items: { type: 'integer', minimum: 0, maximum: 1000 },
              description: '[y_min, x_min, y_max, x_max], normalised 0-1000',
            },
            label: { type: 'string' },
          },
          required: ['position', 'parameter', 'box', 'label'],
          propertyOrdering: ['position', 'parameter', 'box', 'label'],
        },
      },
      observations: { type: 'array', items: { type: 'string' } },
    },
    required: ['parameters', 'annotations', 'observations'],
    propertyOrdering: ['parameters', 'annotations', 'observations'],
  }
}

/**
 * Pass 2 system instruction — the tone rules, concentrated in one small,
 * reviewable prompt. This is the only place model-authored prose reaches the
 * user, so it is where the wellness framing has to hold.
 */
export const NARRATIVE_SYSTEM_INSTRUCTION = `You write short, warm, plain-English wellness summaries for a dental app. You are given observations that have ALREADY been analysed and scored by the system.

Absolute rules:
- Never name, suggest or imply a disease or condition. Say what was observed and what it might mean for a daily routine.
- Never state or contradict a numeric score, percentage, point change or measurement. The app displays those itself. Do not put numbers in your text.
- Never tell the user they are fine when something is flagged, and never alarm them when nothing is.
- Anything that needs attention routes to a professional: "worth a professional look", never "you should be treated for".
- Second person, warm and specific. No jargon. Two sentences where one will not do, never four.`

/** Pass 2 user prompt: the computed result, in words the model can restate. */
export function narrativePrompt(input: {
  score: number
  bands: { parameter: string; band: string; regions: string[] }[]
  observations: string[]
  provisional: boolean
  trend: 'up' | 'down' | 'stable'
  isFirstScan: boolean
}): string {
  const bandLines = input.bands
    .map(
      (entry) =>
        `- ${entry.parameter}: ${entry.band}${entry.regions.length ? ` (seen at: ${entry.regions.join(', ')})` : ''}`,
    )
    .join('\n')

  const context = input.isFirstScan
    ? 'This is their first scan, so there is nothing to compare against — do not refer to previous scans or changes over time.'
    : `Compared with their previous scan, the overall result has gone ${input.trend === 'stable' ? 'essentially unchanged' : input.trend === 'up' ? 'up (improved)' : 'down (worsened)'}.`

  const caveat = input.provisional
    ? 'The photographs were hard to read, so keep the summary cautious and suggest re-scanning in better light.'
    : ''

  return `Here is the system's assessment of this person's scan.

Assessed levels (none < mild < moderate < marked):
${bandLines}

Visual observations recorded:
${input.observations.map((line) => `- ${line}`).join('\n') || '- (none recorded)'}

${context}
${caveat}

Write:
1. "findings" — 2 to 3 short items. Each has a title (what was observed), a detail (where, or what it relates to), and status "good" or "watch".
2. "monitor" — ONLY if something is moderate or marked. A gentle heads-up card: badge is always "Monitor", a title naming the area, a body of 1-2 reassuring sentences, and "recommended" completing the sentence "We recommend ..." (e.g. "a dental review within the next 3 months to track it."). Omit the whole object if nothing warrants it.
3. "actions" — exactly 2 practical next steps. The first has icon "floss" and is a daily-routine tip targeting the most affected area. The second has icon "rescan" and is about scanning again.
4. "insight" — a title naming the main thing to watch (or the main positive), a one-word status ("Watch", "Healthy", "Improving"), a 2-sentence summary, 2-3 likelyCauses as short phrases, and a caution sentence about when to see a dentist.`
}

/** Pass 2 response schema. Text only — it cannot emit a number or a level. */
export function narrativeSchema(): ResponseSchema {
  return {
    type: 'object',
    properties: {
      findings: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            detail: { type: 'string' },
            status: { type: 'string', enum: ['good', 'watch'] },
          },
          required: ['title', 'detail', 'status'],
          propertyOrdering: ['title', 'detail', 'status'],
        },
      },
      monitor: {
        type: 'object',
        properties: {
          badge: { type: 'string' },
          title: { type: 'string' },
          body: { type: 'string' },
          recommended: { type: 'string' },
        },
        required: ['badge', 'title', 'body', 'recommended'],
        propertyOrdering: ['badge', 'title', 'body', 'recommended'],
      },
      actions: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            icon: { type: 'string', enum: ['floss', 'rescan'] },
            title: { type: 'string' },
            detail: { type: 'string' },
          },
          required: ['icon', 'title', 'detail'],
          propertyOrdering: ['icon', 'title', 'detail'],
        },
      },
      insight: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          status: { type: 'string' },
          summary: { type: 'string' },
          likelyCauses: { type: 'array', items: { type: 'string' } },
          caution: { type: 'string' },
        },
        required: ['title', 'status', 'summary', 'likelyCauses', 'caution'],
        propertyOrdering: ['title', 'status', 'summary', 'likelyCauses', 'caution'],
      },
    },
    required: ['findings', 'actions', 'insight'],
    propertyOrdering: ['findings', 'monitor', 'actions', 'insight'],
  }
}
