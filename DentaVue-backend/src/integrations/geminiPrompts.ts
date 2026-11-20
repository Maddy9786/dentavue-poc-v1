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
    'Gingival erythema & edema along marginal gingiva and interdental papillae (inspect Frames 0, 1, 3). Look for color shift from coral-pink to erythematous red/magenta, rolled or blunted papillary tips, glossy surface (loss of stippling), or spontaneous bleeding points. 0 = uniformly pale coral-pink, firm knife-edge margins; 15-39 = localized mild redness or slight papillary swelling on 1-3 teeth; 40-69 = distinct moderate redness/puffiness across multiple teeth; 70-100 = vivid deep-red/swollen margins. Judge by the WORST margin visible in any frame.',
  plaqueExtent:
    'Visible soft microbial biofilm — dull matte white/cream/yellowish accumulation along the cervical third (gumline) and interproximal embrasures (inspect Frames 0, 1, 3). 0 = clean glossy enamel up to the gum margin; 15-39 = thin cervical film or interdental deposits on 1-3 teeth; 40-69 = obvious soft buildup covering >1/3 of cervical crowns on several teeth; 70-100 = heavy thick biofilm across most visible tooth surfaces.',
  gumMarginRecession:
    'Apical migration of the gingival margin below the cemento-enamel junction (CEJ), root cementum/dentin exposure (yellowish root collar), triangular "black triangles" between teeth, or clefting (inspect Frames 0, 1, 3). 0 = gingival margins full, symmetric and coronal to CEJ; 15-39 = minor 1mm margin drop or early root neck visibility on 1-2 teeth; 40-69 = clear root exposure or asymmetric margin drop on 2+ teeth; 70-100 = pronounced root exposure across multiple teeth.',
  enamelWear:
    'Incisal and occlusal enamel loss: flattened biting edges, incisal chipping/notching, exposed yellowish incisal dentin cores, craze lines, or acid-erosion translucency/thinning (inspect Frames 0, 1, 3). 0 = intact, opaque, contoured incisal edges; 15-39 = minor incisal flattening or slight edge translucency; 40-69 = distinct chipped edge, moderate attrition, or visible dentin line; 70-100 = clearly fractured/broken tooth edge or severe crown shortening.',
  tissueAppearance:
    'Dorsal tongue and oral mucosa health (inspect Frame 2 primarily, plus labial/buccal mucosa in Frames 0, 1, 3). Look for white/yellow/brown dorsal tongue biofilm coating, fissuring, geographic patches, scalloped lateral borders, aphthous ulcers, or mucosal erythema/leukoplakia-like patches. 0 = evenly pink dorsal tongue with clean papillae and smooth pink mucosa; 15-39 = thin partial white coating on posterior tongue; 40-69 = thick widespread tongue coating or small localized mucosal spot; 70-100 = heavy dense coating or a distinct ulcer/patch.',
  calculusStain:
    'Mineralised supragingival calculus (hard chalky yellow/tan/brown tartar bridges, especially at lower anterior tooth necks and interdental spaces) and extrinsic chromogenic staining (coffee/tea/tobacco/chlorhexidine brown-black lines) (inspect Frames 0, 1, 3). 0 = no tartar or stain; 15-39 = minor interdental stain or trace cervical tartar; 40-69 = distinct calcified ledge or dark staining on multiple teeth; 70-100 = heavy bridging calculus or extensive dark extrinsic staining.',
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
export const VISION_SYSTEM_INSTRUCTION = `You are a high-precision intraoral image-observation engine in a dental WELLNESS app. You describe what is visible in close-up photographs of a human mouth. You are NOT a diagnostic system.

Step 1 — Mandatory Oral Cavity Gate (CRITICAL):
- Before evaluating any dental parameter, inspect each frame (0..3) individually in "frameChecks".
- Set "isOralCavityVisible" to true ONLY if the frame clearly shows close-up human teeth, gums, or tongue filling at least 25% of the image.
- If a frame shows a random object, room, desk, wall, screen, hand, or a distant full-face selfie where teeth and gums cannot be clearly inspected, set "isOralCavityVisible" to false and "clarity" to 0.0.
- If NONE of the frames clearly show close-up teeth, gums, or tongue (or if the user uploaded non-dental photos), you MUST set "isValidOralScan" to false, provide a clear plain-English "rejectionReason" telling the user what was seen and to retake close-up photos of their teeth/gums, and set all parameter "confidence" values to 0.05.

Step 2 — Absolute Clinical Safety Rules:
- Never name, suggest or imply a disease, condition or diagnosis (no "gingivitis", "periodontitis", "caries", "decay", "infection", "oral cancer").
- Never recommend medical treatment.
- Report only what is VISIBLE in the photographs. Never infer anything that requires a probe, X-ray or clinical examination.
- If an area is not visible, poorly lit, blurred or out of frame, report LOW confidence (0.0 to 0.35) for the parameters that depend on it. Never compensate by guessing, and NEVER report high confidence just because no plaque is visible on a non-dental photo.

Step 3 — High-Precision Severity Calibration (0–100):
- Evaluate exact anatomical sub-regions across the captured angles:
  * Frame 0 (front teeth): labial enamel surfaces, incisal edges, interdental papillae, cervical plaque line.
  * Frame 1 (upper gums): maxillary gingival margin contour, redness/swelling, root exposure.
  * Frame 2 (tongue): dorsal tongue coating, color uniformity, soft tissue surface.
  * Frame 3 (lower gums): mandibular gingival margin position, recession, supragingival tartar/stain.
- Severity is a fine-grained 0-100 scale. Use the full numeric range within each band to reflect exact visual extent and intensity:
  * 0–14 (none/clean): 0-4 pristine, 5-9 minimal normal variation, 10-14 trace finding.
  * 15–39 (mild): 15-22 localized early sign, 23-30 distinct mild area, 31-39 upper-mild approaching moderate.
  * 40–69 (moderate): 40-49 clearly visible across 2+ teeth, 50-59 pronounced regional finding, 60-69 widespread moderate.
  * 70–100 (marked): 70-84 vivid/unmistakable finding (bright-red swollen gums, heavy deposit, distinct ulcer, chipped tooth), 85-100 extensive severe appearance.
- Score each parameter by the WORST-AFFECTED area visible in ANY valid oral frame — do NOT average a clear problem away against healthier frames.

Confidence is 0.0-1.0 and reflects how clearly you could SEE the specific anatomical tissue for that parameter (0.0 = tissue not in frame / non-dental photo; 0.9+ = sharp, well-lit close-up of that tissue).`

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

  return `Assess these ${angles.length} photographs submitted for an intraoral scan, captured in this order:

${frames}

First, populate "frameChecks" for every frame (0..${angles.length - 1}) and determine "isValidOralScan". If the photos do not clearly show human teeth, gums, or tongue up close, set "isValidOralScan" to false, explain why in "rejectionReason", and set all parameter confidences to <= 0.1.

Second, for valid oral scans, report a precise 0-100 severity and 0.0-1.0 visibility confidence for each parameter:

${guide}

For "regions", use simple everyday locations that anyone with zero medical or biological background can immediately picture, such as "lower-left gum edge", "upper front teeth", "back of the tongue", or "lower front teeth near the gums". Avoid Latin or dental terms like "incisors", "maxillary", "mandibular", "cervical", "papillae", or "mucosa". Use an empty list if the parameter is not visibly present anywhere.

Also return "annotations": the specific areas that evidence a parameter, so they can be highlighted on the user's photo. Give each a tight, accurate bounding box in normalised coordinates 0-1000 as [y_min, x_min, y_max, x_max], the exact frame index (0..${angles.length - 1}) it belongs to, the parameter it evidences, and a friendly everyday label (e.g. "slight redness along the gum edge", "soft buildup near the gum line", "light surface staining"). Never use clinical terms in labels. Only annotate what you can clearly see on valid oral tissue — return an empty list rather than a speculative box. Annotate up to 6 distinct regions across the frames.

Finally return "observations": up to 4 short, friendly, everyday sentences describing what is visible across the angles in plain consumer English. No numbers, no medical/biological jargon, no disease names, no advice.`
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
      severity: { type: 'integer', minimum: 0, maximum: 100, description: '0-100 precise severity, higher is worse' },
      confidence: { type: 'number', minimum: 0, maximum: 1, description: 'How clearly the relevant oral tissue is visible (0 if not a mouth)' },
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
      frameChecks: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            position: { type: 'integer', minimum: 0, maximum: 3 },
            isOralCavityVisible: {
              type: 'boolean',
              description: 'True ONLY if close-up human teeth, gums, or tongue are clearly visible',
            },
            clarity: {
              type: 'number',
              minimum: 0,
              maximum: 1,
              description: 'Focus and lighting quality of the oral tissue in this frame (0 if non-oral)',
            },
            note: { type: 'string' },
          },
          required: ['position', 'isOralCavityVisible', 'clarity', 'note'],
          propertyOrdering: ['position', 'isOralCavityVisible', 'clarity', 'note'],
        },
      },
      isValidOralScan: {
        type: 'boolean',
        description: 'False if the photos do not clearly show a close-up human mouth/teeth/gums',
      },
      rejectionReason: {
        type: 'string',
        description: 'Empty string when valid; otherwise a short user-facing instructions sentence explaining which photo(s) must be retaken',
      },
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
    required: ['frameChecks', 'isValidOralScan', 'rejectionReason', 'parameters', 'annotations', 'observations'],
    propertyOrdering: ['frameChecks', 'isValidOralScan', 'rejectionReason', 'parameters', 'annotations', 'observations'],
  }
}

/**
 * Pass 2 system instruction — the tone rules, concentrated in one small,
 * reviewable prompt. This is the only place model-authored prose reaches the
 * user, so it is where the wellness framing has to hold.
 */
export const NARRATIVE_SYSTEM_INSTRUCTION = `You write warm, encouraging, ultra-simple everyday oral care summaries for regular people who have NO biology, medical, or dental background. You are given observations that have ALREADY been scored by the system.

Absolute rules:
- Write so a non-medical person immediately understands every single word:
  * NEVER use biology or dental terms like "inflammation", "mucosa", "erythema", "edema", "papillae", "gingival", "periodontal", "calculus", "mineralised", "biofilm", "attrition", "incisal", "occlusal", "cervical", "lesion", or "abnormality".
  * Instead use friendly everyday words: "redness or puffiness along the gums", "where your gums meet your teeth", "soft everyday buildup", "hardened tartar or tea/coffee stain", "gentle wear on the biting edges", "tongue and inner cheeks", "front teeth", "back chewing teeth".
- Never mention "AI", "algorithm", "model", or "machine learning". Frame everything as their personal mouth check and daily care guide.
- Never name, suggest or imply a disease or medical diagnosis. Say what was seen in simple words and how easy daily habits (like gentler circular brushing or cleaning between teeth) can help.
- Never state or contradict a numeric score, percentage, point change or measurement. The app displays those itself. Do not put numbers in your text.
- Never tell the user they are fine when something is flagged, and never alarm them when nothing is.
- Anything that needs attention routes gently to a dentist or hygienist: "worth having a dentist or hygienist take a quick look", never "you need treatment for".
- Second person ("your gums", "your front teeth"), warm, reassuring and easy to read. Keep sentences short and practical.`

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
    ? 'This is their first mouth check, so there is nothing to compare against — do not refer to previous checks or changes over time.'
    : `Compared with their previous check, the overall result has gone ${input.trend === 'stable' ? 'essentially unchanged' : input.trend === 'up' ? 'up (improved)' : 'down (needs a little extra care)'}.`

  const caveat = input.provisional
    ? 'The photos were a bit tricky to see clearly, so keep the summary gentle and suggest taking another photo in bright natural light.'
    : ''

  return `Here is the assessment of this person's mouth check.

Assessed levels (none < mild < moderate < marked):
${bandLines}

Visual observations recorded:
${input.observations.map((line) => `- ${line}`).join('\n') || '- (none recorded)'}

${context}
${caveat}

Write in simple, friendly, non-biological everyday English:
1. "findings" — 2 to 3 short, easy-to-understand items. Each has a friendly title (what was noticed, in everyday words — e.g. "Gums look calm and healthy" or "A little soft buildup near the back teeth"), a simple detail (where in the mouth, in plain words), and status "good" or "watch".
2. "monitor" — ONLY if something is moderate or marked. A gentle heads-up card: badge is always "Keep an eye on", a simple title naming the area, a body of 1-2 reassuring everyday sentences explaining what was noticed without any medical jargon, and "recommended" completing the sentence "We recommend ..." (e.g. "having a dentist or hygienist take a look at your next check-up."). Omit the whole object if nothing warrants it.
3. "actions" — exactly 2 practical, everyday care tips anyone can follow at home. The first has icon "floss" and is a simple daily brushing or cleaning-between-teeth tip for the main area noticed. The second has icon "rescan" and suggests when to take their next check-in photos.
4. "insight" — a friendly title naming the main thing to focus on (or the main bright spot), a one-word status ("Watch", "Healthy", "Improving"), a warm 2-sentence everyday summary with zero biology jargon, 2-3 likelyCauses written as everyday habits (e.g. "Brushing a bit too firmly along the gum edge", "Tea, coffee or everyday food staining", "Spots between back teeth that a brush can easily miss"), and a gentle caution sentence about visiting a dentist if they notice soreness or bleeding.`
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
