/**
 * Client-side capture-quality & oral-presence check — real image processing.
 *
 * Runs on the canvas the camera already produces, so it is free, instant, works
 * offline, and rejects a bad or non-dental shot BEFORE upload.
 *
 * Distinguishes an ACTUAL close-up of teeth/gums/tongue from plain facial skin
 * (cheeks, forehead, closed mouth) or random background objects by requiring:
 *   1. Deep vascular red/pink mucosa (lips, gingiva, tongue: Cr >= 152, R - G >= 24)
 *   2. Dental/oral contrast inside the target arch (bright tooth enamel pixels
 *      AND/OR dark inner-oral-cavity pixels adjacent to mucosa).
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

const DARK_LUMINANCE = 30
const BLUR_VARIANCE = 135
const MIN_ORAL_SCORE = 0.08
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

interface OralSignatureMetrics {
  score: number
  deepMucosaRatio: number
  enamelRatio: number
  skinOnly: boolean
}

/**
 * Distinguishes an OPEN MOUTH / TEETH / GUMS / TONGUE from ordinary facial skin
 * or background objects inside the central target region.
 *
 * Ordinary facial skin has mild red chrominance (Cr 136–149, R - G ~ 12–22) and
 * uniform luminance.
 * Actual lips, gums, and tongue mucosa have much stronger vascular redness
 * (Cr >= 151, R - G >= 25), AND a smile/open mouth simultaneously contains bright
 * low-saturation tooth enamel pixels (R,G,B > 135, low chroma spread) or deep
 * intraoral cavity contrast.
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
        r > 75 &&
        r - g >= 25 &&
        r - b >= 22 &&
        g < r * 0.82 &&
        cr >= 151 &&
        cr <= 205 &&
        cb >= 80 &&
        cb <= 130

      // 2. Ordinary facial skin (cheeks, forehead, chin)
      const isMildSkin =
        !isDeepMucosa &&
        r > 70 &&
        r > g + 10 &&
        r > b + 12 &&
        cr >= 136 &&
        cr < 151 &&
        cb >= 78 &&
        cb <= 128

      // 3. Bright tooth enamel (ivory/white, high luminance, low saturation)
      const maxC = Math.max(r, g, b)
      const minC = Math.min(r, g, b)
      const saturation = maxC === 0 ? 0 : (maxC - minC) / maxC
      const isEnamel = luma >= 140 && r >= 135 && g >= 130 && b >= 115 && saturation <= 0.26

      // 4. Dark inner mouth cavity shadow
      const isDarkCavity = luma < 42

      if (isDeepMucosa) deepMucosaPixels += 1
      else if (isMildSkin) mildSkinPixels += 1
      else if (isEnamel) enamelPixels += 1
      else if (isDarkCavity) darkCavityPixels += 1
    }
  }

  if (totalPixels === 0) {
    return { score: 0, deepMucosaRatio: 0, enamelRatio: 0, skinOnly: false }
  }

  const deepMucosaRatio = deepMucosaPixels / totalPixels
  const mildSkinRatio = mildSkinPixels / totalPixels
  const enamelRatio = enamelPixels / totalPixels
  const darkCavityRatio = darkCavityPixels / totalPixels

  // If the frame is mostly normal facial skin with almost no deep gum/tongue red
  // and almost no tooth enamel, it's a closed face / cheek / forehead — NOT an open mouth scan!
  const skinOnly = mildSkinRatio > 0.25 && deepMucosaRatio < 0.055 && enamelRatio < 0.04

  if (deepMucosaRatio < 0.035) {
    return { score: deepMucosaRatio, deepMucosaRatio, enamelRatio, skinOnly }
  }

  // Score rewards combination of vascular gum/lip/tongue tissue + bright tooth enamel / oral cavity
  const score = Math.min(
    1,
    deepMucosaRatio * 1.2 + Math.min(0.25, enamelRatio * 1.1) + Math.min(0.08, darkCavityRatio * 0.5),
  )

  return { score, deepMucosaRatio, enamelRatio, skinOnly }
}

/** The verdict, from pixels. Darkness → No Mouth → Blur priority. */
function verdict(luminance: number, sharpness: number, oral: OralSignatureMetrics): ImageQuality {
  if (luminance < DARK_LUMINANCE) {
    return { status: 'retake', flag: 'Too dark', luminance, sharpness, oralRatio: oral.score }
  }
  if (oral.skinOnly || oral.score < MIN_ORAL_SCORE) {
    return {
      status: 'retake',
      flag: 'No teeth/mouth visible',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (sharpness < BLUR_VARIANCE) {
    return { status: 'retake', flag: 'Blurry', luminance, sharpness, oralRatio: oral.score }
  }
  return { status: 'sharp', luminance, sharpness, oralRatio: oral.score }
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
  const oral = analyzeOralSignature(imageData.data, imageData.width, imageData.height)
  return verdict(lum, sharp, oral)
}

/**
 * Ultra-fast synchronous live video frame analyser (~1.5ms at 160px width).
 * Powers the live Red / Amber / Green traffic-light guide ring on the camera
 * viewfinder so non-technical users know immediately when to press the shutter.
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
  const oral = analyzeOralSignature(imageData.data, width, height)

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
      message: 'Open mouth / smile wide to show your teeth & gums inside the guide',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (oral.score < MIN_ORAL_SCORE) {
    return {
      state: 'invalid',
      message: 'Point camera at your mouth & fill the dashed guide',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  if (sharpness < 55 || oral.score < 0.14) {
    return {
      state: 'adjust',
      message: 'Almost there — bring teeth closer & hold steady',
      luminance,
      sharpness,
      oralRatio: oral.score,
    }
  }
  return {
    state: 'ready',
    message: '✓ Teeth & gums aligned! Tap the shutter button below to capture',
    luminance,
    sharpness,
    oralRatio: oral.score,
  }
}
