/**
 * Client-side capture-quality & oral-presence check — real image processing.
 *
 * Runs on the canvas the camera already produces, so it is free, instant, works
 * offline, and blocks a non-dental shot IMMEDIATELY on the current step before
 * allowing the user to advance to the next step.
 *
 * Distinguishes an ACTUAL close-up of teeth/gums/tongue from plain facial skin
 * (cheeks, forehead, closed mouth), hands, or random background objects by requiring:
 *   1. Deep vascular red/pink mucosa (lips, gingiva, tongue: Cr >= 151, R - G >= 24)
 *   2. Angle-appropriate dental/oral signature inside the target frame:
 *      - Teeth/Gum steps ('front-teeth', 'upper-gums', 'lower-gums') require BOTH
 *        vascular gum/lip tissue AND bright low-saturation tooth enamel pixels.
 *      - Tongue step ('tongue') requires strong central vascular tongue tissue +
 *        open-mouth contrast.
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
  /** True when the photo is NOT a valid oral/dental photo (blocks step advancement). */
  isNonOral?: boolean
  /** Short reason shown on the review card or rejection alert when status is 'retake'. */
  flag?: string
  /** Detailed user-facing reason explaining why the photo was rejected on the current step. */
  rejectionDetail?: string
  /** Raw metrics, exposed for tuning/telemetry — not shown to the user. */
  luminance: number
  sharpness: number
  oralRatio: number
}

const SAMPLE_WIDTH = 400
const LIVE_SAMPLE_WIDTH = 160

const DARK_LUMINANCE = 30
const BLUR_VARIANCE = 130
const MIN_ORAL_SCORE = 0.085
const CENTER_FRACTION = 0.56

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
  enamelRatio: number
  skinOnly: boolean
  isValidForStep: boolean
}

/**
 * Distinguishes an OPEN MOUTH / TEETH / GUMS / TONGUE from ordinary facial skin,
 * hands, walls, screens, or background objects inside the central target region.
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
  let mildSkinPixels = 0
  let enamelPixels = 0
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

      // 1. Deep vascular pink/red (gums, tongue, inner lips) — strictly redder than facial skin
      const isDeepMucosa =
        r > 72 &&
        r - g >= 24 &&
        r - b >= 20 &&
        g < r * 0.83 &&
        cr >= 150 &&
        cr <= 205 &&
        cb >= 80 &&
        cb <= 132

      // 2. Ordinary facial skin (cheeks, forehead, chin, hand)
      const isMildSkin =
        !isDeepMucosa &&
        r > 70 &&
        r > g + 10 &&
        r > b + 12 &&
        cr >= 136 &&
        cr < 150 &&
        cb >= 78 &&
        cb <= 128

      // 3. Bright tooth enamel (ivory/white, high luminance, low saturation)
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC
      const isEnamel = luma >= 135 && r >= 130 && g >= 125 && b >= 110 && saturation <= 0.28

      // 4. Dark inner mouth cavity shadow
      const isDarkCavity = luma < 45

      if (isDeepMucosa) deepMucosaPixels += 1
      else if (isMildSkin) mildSkinPixels += 1
      else if (isEnamel) enamelPixels += 1
      else if (isDarkCavity) darkCavityPixels += 1
    }
  }

  if (totalPixels === 0) {
    return { score: 0, deepMucosaRatio: 0, enamelRatio: 0, skinOnly: false, isValidForStep: false }
  }

  const deepMucosaRatio = deepMucosaPixels / totalPixels
  const mildSkinRatio = mildSkinPixels / totalPixels
  const enamelRatio = enamelPixels / totalPixels
  const darkCavityRatio = darkCavityPixels / totalPixels

  // Plain face / hand / cheek with mouth closed
  const skinOnly = mildSkinRatio > 0.24 && deepMucosaRatio < 0.055 && enamelRatio < 0.035

  const score =
    deepMucosaRatio < 0.032
      ? deepMucosaRatio
      : Math.min(
          1,
          deepMucosaRatio * 1.2 +
            Math.min(0.25, enamelRatio * 1.1) +
            Math.min(0.08, darkCavityRatio * 0.5),
        )

  // Step-specific verification:
  // - Teeth/Gums steps require BOTH vascular gum/lip tissue AND tooth enamel / oral cavity contrast
  // - Tongue step requires strong vascular tongue mucosa (deepMucosaRatio >= 0.065)
  const isTongueStep = stepId === 'tongue'
  const isValidForStep = isTongueStep
    ? !skinOnly && deepMucosaRatio >= 0.055 && score >= MIN_ORAL_SCORE
    : !skinOnly &&
      deepMucosaRatio >= 0.035 &&
      (enamelRatio >= 0.015 || darkCavityRatio >= 0.03) &&
      score >= MIN_ORAL_SCORE

  return { score, deepMucosaRatio, enamelRatio, skinOnly, isValidForStep }
}

const STEP_LABELS: Record<string, string> = {
  'front-teeth': 'Front teeth',
  'upper-gums': 'Upper gums & top teeth',
  tongue: 'Tongue',
  'lower-gums': 'Lower gums & bottom teeth',
}

/** The verdict, from pixels. Blocks non-oral & dark photos immediately; allows slightly blurry oral photos to proceed with a flag. */
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
      rejectionDetail: `This photo is too dark to see your ${stepName.toLowerCase()}. Please turn on the 💡 Light or face a bright light and snap again.`,
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
      rejectionDetail: oral.skinOnly
        ? `Your mouth appears closed or out of the frame. Please open wide and align your ${stepName.toLowerCase()} inside the dashed guide to continue.`
        : `Wrong photo! We couldn't detect your ${stepName.toLowerCase()} in this picture. Please take a real close-up of your ${stepName.toLowerCase()} to move to the next step.`,
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
  if (!imageData) return { status: 'sharp', isNonOral: false, luminance: 0, sharpness: 0, oralRatio: 1 }
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
  if (oral.skinOnly) {
    return {
      state: 'adjust',
      message: `Open mouth wide to show your ${stepName.toLowerCase()} inside the guide`,
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
  if (sharpness < 52 || oral.score < 0.13) {
    return {
      state: 'adjust',
      message: `Almost there — bring ${stepName.toLowerCase()} closer & hold steady`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  return {
    state: 'ready',
    message: `✓ ${stepName} aligned! Tap the shutter button below to capture`,
    luminance,
    sharpness,
    oralRatio: oral.score,
  }
}
