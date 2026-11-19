/**
 * Client-side capture-quality & oral-presence check — real image processing.
 *
 * Runs on the canvas the camera already produces, so it is free, instant, works
 * offline, and rejects a bad or non-dental shot BEFORE upload, while the user is
 * still holding their phone.
 *
 * Three checks, all fast:
 *   1. "Too dark"          → mean luminance below a floor
 *   2. "Blurry"            → Laplacian variance of the CENTRE region below a floor
 *   3. "No mouth detected" → Oral chromaticity check inside the central target box
 *                            (verifies presence of warm pink/red lip/gum/tongue
 *                            mucosa tones and tooth-enamel luminance so photos of
 *                            desks, walls, screens, or random objects are flagged).
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
  /** Short reason shown on the review card when status is 'retake'. */
  flag?: string
  /** Raw metrics, exposed for tuning/telemetry — not shown to the user. */
  luminance: number
  sharpness: number
  oralRatio: number
}

const SAMPLE_WIDTH = 400
const LIVE_SAMPLE_WIDTH = 160

// Mean luminance (0–255) below this reads as too dark to analyse.
const DARK_LUMINANCE = 30

// Center-region Laplacian variance below this reads as blurred/soft.
const BLUR_VARIANCE = 135

// Minimum fraction of the central target region that must exhibit oral/lip/gum/tongue
// warm chromaticity. Random rooms, desks, laptops, walls, or ceilings sit at 0.00–0.03;
// a real close-up mouth/tongue/gum shot sits at 0.14–0.65.
const MIN_ORAL_MUCOSA_RATIO = 0.065

const CENTER_FRACTION = 0.55

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

/**
 * Measures the fraction of pixels in the central target zone that match
 * oral tissue (lips, gums, tongue mucosa) + dental contrast.
 *
 * Why this works reliably for non-technical users:
 * - A real intraoral photo always has pink/red vascular tissue (lips, gingiva,
 *   tongue, oral mucosa) where Red strictly leads Green and Blue with warm
 *   YCrCb red-difference chrominance (Cr > 138), alongside brighter enamel or
 *   darker oral cavity shadows.
 * - Neutral/cool objects (walls, desks, keyboards, paper, outdoor scenes, blank
 *   ceilings) lack concentrated central oral-mucosa chrominance + oral contrast.
 */
function centerOralTissueRatio(data: Uint8ClampedArray, width: number, height: number): number {
  const marginX = Math.floor((width * (1 - CENTER_FRACTION)) / 2)
  const marginY = Math.floor((height * (1 - CENTER_FRACTION)) / 2)
  const x0 = Math.max(0, marginX)
  const y0 = Math.max(0, marginY)
  const x1 = Math.min(width, width - marginX)
  const y1 = Math.min(height, height - marginY)

  let totalPixels = 0
  let mucosaPixels = 0
  let enamelOrHighlightPixels = 0

  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const idx = (y * width + x) * 4
      const r = data[idx]!
      const g = data[idx + 1]!
      const b = data[idx + 2]!
      totalPixels += 1

      // Convert RGB to YCrCb red/blue chrominance components
      const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b
      const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b

      // Oral mucosa / gingival / lip / tongue chromatic signature:
      // Red channel dominates Green & Blue, warm Cr, moderate Cb
      const isOralPinkOrRed =
        r > 60 &&
        r > g + 14 &&
        r > b + 14 &&
        g < r * 0.88 &&
        cr >= 137 &&
        cr <= 195 &&
        cb >= 75 &&
        cb <= 132

      // Enamel / tooth surface signature (bright ivory/white pixels)
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      const isEnamelLike = r > 125 && g > 115 && b > 100 && maxC - minC < 70

      if (isOralPinkOrRed) mucosaPixels += 1
      else if (isEnamelLike) enamelOrHighlightPixels += 1
    }
  }

  if (totalPixels === 0) return 0
  const mucosaRatio = mucosaPixels / totalPixels
  const enamelRatio = enamelOrHighlightPixels / totalPixels

  // Require real pink/red oral tissue in the target box; enamel boosts the score
  // only when at least some surrounding lip/gum tissue is present.
  if (mucosaRatio < 0.03) return mucosaRatio
  return Math.min(1, mucosaRatio + Math.min(0.15, enamelRatio * 0.4))
}

/** The verdict, from pixels. Darkness → No Mouth → Blur priority. */
function verdict(luminance: number, sharpness: number, oralRatio: number): ImageQuality {
  if (luminance < DARK_LUMINANCE) {
    return { status: 'retake', flag: 'Too dark', luminance, sharpness, oralRatio }
  }
  if (oralRatio < MIN_ORAL_MUCOSA_RATIO) {
    return { status: 'retake', flag: 'No mouth detected', luminance, sharpness, oralRatio }
  }
  if (sharpness < BLUR_VARIANCE) {
    return { status: 'retake', flag: 'Blurry', luminance, sharpness, oralRatio }
  }
  return { status: 'sharp', luminance, sharpness, oralRatio }
}

/**
 * Assess a captured image (a data URL from the camera canvas or a picked file).
 */
export async function assessImageQuality(dataUrl: string): Promise<ImageQuality> {
  const imageData = await toImageData(dataUrl)
  if (!imageData) return { status: 'sharp', luminance: 0, sharpness: 0, oralRatio: 1 }
  const gray = toGrayscale(imageData.data)
  const lum = meanLuminance(gray)
  const sharp = centerLaplacianVariance(gray, imageData.width, imageData.height)
  const oral = centerOralTissueRatio(imageData.data, imageData.width, imageData.height)
  return verdict(lum, sharp, oral)
}

/**
 * Ultra-fast synchronous live video frame analyser (~1.5ms at 160px width).
 * Powers the live Red / Amber / Green traffic-light guide ring on the camera
 * viewfinder so non-technical users know immediately when to press the shutter.
 *
 * `cropZoom` (1.0–3.0) crops the center of the video stream to match the exact
 * zoomed-in region currently displayed in the viewfinder.
 */
export function assessLiveVideoFrame(
  video: HTMLVideoElement,
  cropZoom = 1,
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
  const oralRatio = centerOralTissueRatio(imageData.data, width, height)

  if (luminance < DARK_LUMINANCE) {
    return {
      state: 'invalid',
      message: 'Too dark — turn on the 💡 Light or face a window',
      luminance,
      sharpness,
      oralRatio,
    }
  }
  if (oralRatio < MIN_ORAL_MUCOSA_RATIO) {
    return {
      state: 'invalid',
      message: 'Bring your mouth & teeth close inside the target frame',
      luminance,
      sharpness,
      oralRatio,
    }
  }
  // At 160px sample width, Laplacian variance scales down ~2.2x vs 400px width
  if (sharpness < 52 || oralRatio < 0.11) {
    return {
      state: 'adjust',
      message: 'Almost there — move slightly closer & hold steady',
      luminance,
      sharpness,
      oralRatio,
    }
  }
  return {
    state: 'ready',
    message: '✓ Mouth aligned & clear — tap shutter to capture!',
    luminance,
    sharpness,
    oralRatio,
  }
}
