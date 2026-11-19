/**
 * Client-side capture-quality & oral-presence check — real image processing.
 *
 * Calibrated for BOTH daylight and nighttime indoor room lighting on mobile
 * front/back cameras across all 4 intraoral steps:
 *   1. Front Teeth
 *   2. Upper Gums
 *   3. Tongue
 *   4. Lower Gums
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
  /** True ONLY when the photo is clearly a non-human/non-oral object or pitch black. */
  isNonOral?: boolean
  /** Short reason shown on the review card when status is 'retake'. */
  flag?: string
  /** Detailed user-facing reason explaining why the photo was flagged. */
  rejectionDetail?: string
  luminance: number
  sharpness: number
  oralRatio: number
}

const SAMPLE_WIDTH = 400
const LIVE_SAMPLE_WIDTH = 160

// Nighttime intraoral shots (inside an open mouth) are naturally dim; only trip below 15.
const DARK_LUMINANCE = 15
const BLUR_VARIANCE = 85
const CENTER_FRACTION = 0.65

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
  warmOralRatio: number
  isValidForStep: boolean
}

/**
 * Calibrated for real indoor/nighttime smartphone cameras:
 * Under warm indoor bulbs or dim intraoral shadow, gums/tongue/lips have
 * R > G (even by +4..+12) and Cr >= 131. Only non-human objects (blue/green/grey
 * screens, walls, furniture, pitch-black frames) lack warm biological chrominance.
 */
function analyzeOralSignature(
  data: Uint8ClampedArray,
  width: number,
  height: number,
): OralSignatureMetrics {
  const marginX = Math.floor((width * (1 - CENTER_FRACTION)) / 2)
  const marginY = Math.floor((height * (1 - CENTER_FRACTION)) / 2)
  const x0 = Math.max(0, marginX)
  const y0 = Math.max(0, marginY)
  const x1 = Math.min(width, width - marginX)
  const y1 = Math.min(height, height - marginY)

  let totalPixels = 0
  let warmBioPixels = 0
  let strongMucosaPixels = 0
  let enamelOrHighlightPixels = 0

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

      // Vascular mucosa (gums, tongue, lips) even in dim indoor light
      const isStrongMucosa = r > 32 && r - g >= 10 && r >= b + 6 && cr >= 137 && cb <= 140

      // Any warm biological tissue (mucosa, coated tongue, shadowed gums, lips)
      const isWarmBio = r > 28 && r >= g + 4 && cr >= 131 && cr <= 215 && cb >= 70 && cb <= 142

      // Enamel or light-coated tongue
      const isEnamelOrCoating = luma >= 95 && r >= 90 && g >= 85 && b >= 75

      if (isStrongMucosa) strongMucosaPixels += 1
      if (isWarmBio) warmBioPixels += 1
      if (isEnamelOrCoating) enamelOrHighlightPixels += 1
    }
  }

  if (totalPixels === 0) {
    return { score: 0, warmOralRatio: 0, isValidForStep: false }
  }

  const strongRatio = strongMucosaPixels / totalPixels
  const warmOralRatio = warmBioPixels / totalPixels
  const enamelRatio = enamelOrHighlightPixels / totalPixels

  const score = Math.min(1, strongRatio * 1.4 + warmOralRatio * 0.7 + Math.min(0.2, enamelRatio * 0.5))

  // Accept if there is genuine biological/oral tissue in the frame; reject only
  // non-biological objects (desks, walls, screens, ceiling, keyboards where warmOralRatio < 0.04)
  const isValidForStep = warmOralRatio >= 0.04 || strongRatio >= 0.015

  return { score, warmOralRatio, isValidForStep }
}

const STEP_LABELS: Record<string, string> = {
  'front-teeth': 'Front teeth',
  'upper-gums': 'Upper gums',
  tongue: 'Tongue',
  'lower-gums': 'Lower gums',
}

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
      rejectionDetail: `This photo is pitch dark. Turn on room light or tap "Use Photo Anyway" below.`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (!oral.isValidForStep) {
    return {
      status: 'retake',
      isNonOral: true,
      flag: 'No mouth detected',
      rejectionDetail: `This doesn't look like your ${stepName.toLowerCase()}. Retake pointing at your mouth, or tap "Use Photo Anyway".`,
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
  const oral = analyzeOralSignature(imageData.data, imageData.width, imageData.height)
  return verdict(lum, sharp, oral, stepId)
}

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
  const oral = analyzeOralSignature(imageData.data, width, height)
  const stepName = STEP_LABELS[stepId] ?? 'teeth & gums'

  if (luminance < DARK_LUMINANCE) {
    return {
      state: 'invalid',
      message: 'Too dark — turn on room light',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (!oral.isValidForStep) {
    return {
      state: 'invalid',
      message: `Point camera at your ${stepName.toLowerCase()}`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (sharpness < 32 || oral.score < 0.08) {
    return {
      state: 'adjust',
      message: `Hold steady on your ${stepName.toLowerCase()}`,
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  return {
    state: 'ready',
    message: `✓ ${stepName} ready! Tap the shutter button below`,
    luminance,
    sharpness,
    oralRatio: oral.score,
  }
}
