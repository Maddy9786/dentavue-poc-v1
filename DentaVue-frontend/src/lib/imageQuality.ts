/**
 * Client-side capture-quality & oral-presence check — real image processing.
 *
 * Calibrated for real smartphone cameras across all 4 intraoral steps:
 *   1. Front Teeth  (bright enamel + pink gums/lips)
 *   2. Upper Gums   (coral/pale pink gingiva, often in slight indoor shadow)
 *   3. Tongue       (pink/red dorsal tongue, often with light whitish coating)
 *   4. Lower Gums   (mandibular gingiva + lower tooth necks)
 *
 * Rejects non-oral objects (walls, desks, laptops, floors, ceilings, blank dark frames)
 * while never false-rejecting shadowed gums or coated tongues.
 */

export type ScanQualityStatus = 'sharp' | 'retake'

export type LiveAlignmentState = 'ready' | 'adjust' | 'invalid'

export interface LiveFrameFeedback {
  state: LiveAlignmentState
  message: string
  luminance: number
  sharpness: number
  oralRatio: number
}

export interface ImageQuality {
  status: ScanQualityStatus
  /** True when the photo is NOT a valid oral/dental photo (triggers warning modal). */
  isNonOral?: boolean
  /** Short reason shown on the review card or rejection alert when status is 'retake'. */
  flag?: string
  /** Detailed user-facing reason explaining why the photo was flagged. */
  rejectionDetail?: string
  /** Raw metrics, exposed for tuning/telemetry — not shown to the user. */
  luminance: number
  sharpness: number
  oralRatio: number
}

const SAMPLE_WIDTH = 400
const LIVE_SAMPLE_WIDTH = 160

const DARK_LUMINANCE = 24
const BLUR_VARIANCE = 115
const CENTER_FRACTION = 0.6

/** Draws a data URL to a normalised-width canvas and returns its pixels. */
function toImageData(dataUrl: string): Promise<ImageData | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, SAMPLE_WIDTH / img.width)
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      resolve(ctx.getImageData(0, 0, width, height))
    }
    img.onerror = () => resolve(null)
    img.src = dataUrl
  })
}

/** Rec. 601 luma from the RGBA buffer, one value per pixel. */
function toGrayscale(data: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(data.length / 4)
  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    gray[p] = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!
  }
  return gray
}

function meanLuminance(gray: Float32Array): number {
  let sum = 0
  for (let i = 0; i < gray.length; i += 1) sum += gray[i]!
  return sum / gray.length
}

/**
 * Variance of the 4-neighbour discrete Laplacian over the CENTRE region only.
 */
function centerLaplacianVariance(gray: Float32Array, width: number, height: number): number {
  const marginX = Math.floor((width * (1 - CENTER_FRACTION)) / 2)
  const marginY = Math.floor((height * (1 - CENTER_FRACTION)) / 2)
  const x0 = Math.max(1, marginX)
  const y0 = Math.max(1, marginY)
  const x1 = Math.min(width - 1, width - marginX)
  const y1 = Math.min(height - 1, height - marginY)

  const values: number[] = []
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const i = y * width + x
      const lap = 4 * gray[i]! - gray[i - 1]! - gray[i + 1]! - gray[i - width]! - gray[i + width]!
      values.push(lap)
    }
  }
  if (values.length === 0) return 0
  const mean = values.reduce((sum, v) => sum + v, 0) / values.length
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
  return variance
}

interface OralSignatureMetrics {
  score: number
  deepMucosaRatio: number
  warmTissueRatio: number
  enamelRatio: number
  isValidForStep: boolean
}

/**
 * Evaluates oral tissue presence across all 4 steps, accounting for:
 * - Pale/coral gums in shadow when tilting the chin (Steps 2 & 4)
 * - Coated/pale pink dorsal tongue surfaces (Step 3)
 * - Front teeth enamel + lip/gum borders (Step 1)
 */
function analyzeOralSignature(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  stepId = 'front-teeth',
): OralSignatureMetrics {
  const marginX = Math.floor((width * (1 - CENTER_FRACTION)) / 2)
  const marginY = Math.floor((height * (1 - CENTER_FRACTION)) / 2)
  const x0 = Math.max(0, marginX)
  const y0 = Math.max(0, marginY)
  const x1 = Math.min(width, width - marginX)
  const y1 = Math.min(height, height - marginY)

  let totalPixels = 0
  let deepMucosaPixels = 0
  let warmTissuePixels = 0
  let enamelOrCoatedTonguePixels = 0
  let darkCavityPixels = 0

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * 4
      const r = data[idx]!
      const g = data[idx + 1]!
      const b = data[idx + 2]!
      totalPixels += 1

      const luma = 0.299 * r + 0.587 * g + 0.114 * b
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b

      // 1. Rich vascular pink/red (gums, tongue edges, lips) — works even in dim intraoral shadow (r > 48)
      const isDeepMucosa =
        r > 48 &&
        r - g >= 16 &&
        r - b >= 14 &&
        g < r * 0.87 &&
        cr >= 143 &&
        cr <= 208 &&
        cb >= 76 &&
        cb <= 135

      // 2. Broader warm tissue / pale pink mucosa / coated tongue / surrounding lips
      const isWarmTissue =
        r > 50 &&
        r > g + 8 &&
        r > b + 8 &&
        cr >= 136 &&
        cr <= 208 &&
        cb >= 75 &&
        cb <= 136

      // 3. Tooth enamel OR light-coated tongue dorsal surface
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC
      const isEnamelOrCoating = luma >= 115 && r >= 110 && g >= 100 && b >= 90 && saturation <= 0.32

      // 4. Inner mouth cavity shadow
      const isDarkCavity = luma < 52

      if (isDeepMucosa) deepMucosaPixels += 1
      if (isWarmTissue) warmTissuePixels += 1
      if (isEnamelOrCoating) enamelOrCoatedTonguePixels += 1
      if (isDarkCavity) darkCavityPixels += 1
    }
  }

  if (totalPixels === 0) {
    return {
      score: 0,
      deepMucosaRatio: 0,
      warmTissueRatio: 0,
      enamelRatio: 0,
      isValidForStep: false,
    }
  }

  const deepMucosaRatio = deepMucosaPixels / totalPixels
  const warmTissueRatio = warmTissuePixels / totalPixels
  const enamelRatio = enamelOrCoatedTonguePixels / totalPixels
  const darkCavityRatio = darkCavityPixels / totalPixels

  const score = Math.min(
    1,
    deepMucosaRatio * 1.3 +
      warmTissueRatio * 0.45 +
      Math.min(0.25, enamelRatio * 0.9) +
      Math.min(0.1, darkCavityRatio * 0.4),
  )

  // Step-aware acceptance:
  // - Step 1 (front-teeth) needs clear pink/red mucosa + enamel/cavity contrast
  // - Steps 2, 3, 4 (upper-gums, tongue, lower-gums) accept any real oral/gum/tongue tissue
  //   (deepMucosaRatio >= 0.022 OR warmTissueRatio >= 0.08) so shadowed gums & coated tongues pass smoothly!
  const isHardStep = stepId === 'upper-gums' || stepId === 'tongue' || stepId === 'lower-gums'
  const isValidForStep = isHardStep
    ? (deepMucosaRatio >= 0.02 || warmTissueRatio >= 0.075) && score >= 0.055
    : deepMucosaRatio >= 0.028 &&
      (enamelRatio >= 0.012 || darkCavityRatio >= 0.025 || warmTissueRatio >= 0.12) &&
      score >= 0.07

  return { score, deepMucosaRatio, warmTissueRatio, enamelRatio, isValidForStep }
}

const STEP_LABELS: Record<string, string> = {
  'front-teeth': 'Front teeth',
  'upper-gums': 'Upper gums',
  tongue: 'Tongue',
  'lower-gums': 'Lower gums',
}

/** The verdict, from pixels. */
function verdict(
  luminance: number,
  sharpness: number,
  oral: OralSignatureMetrics,
  stepId = 'front-teeth',
): ImageQuality {
  const stepName = STEP_LABELS[stepId] ?? 'mouth'

  if (luminance < DARK_LUMINANCE) {
    return {
      status: 'retake',
      isNonOral: true,
      flag: 'Too dark',
      rejectionDetail: `This photo is too dark to see your ${stepName.toLowerCase()}. Turn on the 💡 Light button or face a window, or tap "Use Photo Anyway" below.`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (!oral.isValidForStep) {
    return {
      status: 'retake',
      isNonOral: true,
      flag: 'No teeth/mouth visible',
      rejectionDetail: `We couldn't clearly detect your ${stepName.toLowerCase()} in this shot. Retake it closer to the guide, or tap "Use Photo Anyway" if your mouth is visible.`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (sharpness < BLUR_VARIANCE) {
    return {
      status: 'retake',
      isNonOral: false,
      flag: 'Blurry',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  return { status: 'sharp', isNonOral: false, luminance, sharpness, oralRatio: oral.score }
}

/**
 * Assess a captured image (a data URL from the camera canvas or a picked file)
 * for a specific guided-scan step.
 */
export async function assessImageQuality(
  dataUrl: string,
  stepId = 'front-teeth',
): Promise<ImageQuality> {
  const imageData = await toImageData(dataUrl)
  if (!imageData)
    return { status: 'sharp', isNonOral: false, luminance: 0, sharpness: 0, oralRatio: 1 }
  const gray = toGrayscale(imageData.data)
  const lum = meanLuminance(gray)
  const sharp = centerLaplacianVariance(gray, imageData.width, imageData.height)
  const oral = analyzeOralSignature(imageData.data, imageData.width, imageData.height, stepId)
  return verdict(lum, sharp, oral, stepId)
}

/**
 * Ultra-fast synchronous live video frame analyser (~1.5ms at 160px width).
 */
export function assessLiveVideoFrame(
  video: HTMLVideoElement,
  cropZoom = 1,
  stepId = 'front-teeth',
): LiveFrameFeedback | null {
  if (!video.videoWidth || !video.videoHeight) return null
  const z = Math.max(1, Math.min(3.5, cropZoom))
  const srcW = video.videoWidth / z
  const srcH = video.videoHeight / z
  const srcX = (video.videoWidth - srcW) / 2
  const srcY = (video.videoHeight - srcH) / 2

  const scale = Math.min(1, LIVE_SAMPLE_WIDTH / srcW)
  const width = Math.max(1, Math.round(srcW * scale))
  const height = Math.max(1, Math.round(srcH * scale))

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return null

  ctx.drawImage(video, srcX, srcY, srcW, srcH, 0, 0, width, height)
  const imageData = ctx.getImageData(0, 0, width, height)
  const gray = toGrayscale(imageData.data)
  const luminance = meanLuminance(gray)
  const sharpness = centerLaplacianVariance(gray, width, height)
  const oral = analyzeOralSignature(imageData.data, width, height, stepId)
  const stepName = STEP_LABELS[stepId] ?? 'teeth & gums'

  if (luminance < DARK_LUMINANCE) {
    return {
      state: 'invalid',
      message: 'Too dark — turn on 💡 Light or face a bright light',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (!oral.isValidForStep) {
    return {
      state: 'invalid',
      message: `Point camera at your ${stepName.toLowerCase()} & fill the guide`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (sharpness < 45 || oral.score < 0.1) {
    return {
      state: 'adjust',
      message: `Almost there — hold steady on your ${stepName.toLowerCase()}`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  return {
    state: 'ready',
    message: `✓ ${stepName} aligned! Tap the shutter button below`,
    luminance,
    sharpness,
    oralRatio: oral.score,
  }
}
