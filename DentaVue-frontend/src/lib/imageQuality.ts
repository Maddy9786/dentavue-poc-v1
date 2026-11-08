/**
 * Client-side capture-quality check — real image processing, not a placeholder.
 *
 * Runs on the canvas the camera already produces, so it is free, instant, works
 * offline, and — the point — rejects a bad shot BEFORE upload, while the user is
 * still in front of the mirror. This is integration point #1 in AI_INTEGRATION.md,
 * which argued it should be classical CV rather than a model: blur and exposure
 * are solved image processing, and a VLM round-trip here would be slower, cost
 * money, and be less reliable at exactly the thing a Laplacian does perfectly.
 *
 * Two checks, both cheap:
 *   - "Too dark"  → mean luminance below a floor
 *   - "Blurry"    → Laplacian variance of the CENTRE region below a floor. Centre,
 *                   not the whole frame, because a global measure is fooled by a
 *                   textured background: a blurred subject against patterned
 *                   wallpaper keeps high edge energy at the edges and reads sharp.
 *
 * It cannot detect "mouth too far / not in frame" — that needs a face/landmark
 * model — so an in-focus photo of a distant face passes here and is caught later
 * by the backend's confidence floor (unreadable → retake). What this DOES catch,
 * honestly and per image, is the genuinely dark or genuinely out-of-focus frame.
 */

export type ScanQualityStatus = 'sharp' | 'retake'

export interface ImageQuality {
  status: ScanQualityStatus
  /** Short reason shown on the review card when status is 'retake'. */
  flag?: string
  /** Raw metrics, exposed for tuning/telemetry — not shown to the user. */
  luminance: number
  sharpness: number
}

// Assessed at a normalised width so the thresholds mean the same thing whatever
// the camera or file resolution. Big enough to preserve edges, small enough to
// stay well under a frame's time budget.
const SAMPLE_WIDTH = 400

// Mean luminance (0–255) below this reads as too dark to analyse. Deliberately
// LOW: the intraoral angles (mouth open, less light reaching the back) are
// naturally dimmer than the front-teeth shot, and flagging every one of them as
// "Too dark" was the observed false positive. This now trips only on a genuinely
// black/near-black frame; a dim-but-usable capture passes and the backend's
// unreadable check (confidence floor) is the real backstop for "no teeth seen".
const DARK_LUMINANCE = 28

// Center-region Laplacian variance below this reads as blurred/soft. Measured on
// real captures: a good close-up (teeth/gums filling the middle) sits at 225-385;
// a blurred or empty subject collapses well below 100. 140 splits them with
// margin in both directions — it clears the softest good frame ~1.6x and still
// catches an out-of-focus one.
const BLUR_VARIANCE = 140

// The blur measure looks only at the middle of the frame (this fraction on each
// axis), NOT the whole image. WHY: a global focus measure is fooled by a busy
// background — a blurred face against patterned wallpaper still has high edge
// energy at the edges and reads "sharp". The subject (mouth) belongs in the
// centre, framed by the capture guide, so its sharpness is what matters.
const CENTER_FRACTION = 0.5

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
 * Variance of the 4-neighbour discrete Laplacian — the standard "focus measure" —
 * computed over the CENTRE region only (see CENTER_FRACTION). A sharp subject has
 * strong edges and a high variance; a blurred one is smooth and low. Restricting
 * to the centre is what stops a busy background (patterned wall, a doorway) from
 * masking a blurred subject: the edge energy that matters is where the mouth is.
 * Border pixels of the region are skipped (no full neighbourhood).
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

/** The verdict, from pixels. Darkness wins over blur when both trip. */
function verdict(luminance: number, sharpness: number): ImageQuality {
  if (luminance < DARK_LUMINANCE) {
    return { status: 'retake', flag: 'Too dark', luminance, sharpness }
  }
  if (sharpness < BLUR_VARIANCE) {
    return { status: 'retake', flag: 'Blurry', luminance, sharpness }
  }
  return { status: 'sharp', luminance, sharpness }
}

/**
 * Assess a captured image (a data URL from the camera canvas or a picked file).
 *
 * Returns `sharp` on any internal failure — a quality check that cannot run must
 * not block a capture. The AI layer is the backstop for anything this misses.
 */
export async function assessImageQuality(dataUrl: string): Promise<ImageQuality> {
  const imageData = await toImageData(dataUrl)
  if (!imageData) return { status: 'sharp', luminance: 0, sharpness: 0 }
  const gray = toGrayscale(imageData.data)
  return verdict(meanLuminance(gray), centerLaplacianVariance(gray, imageData.width, imageData.height))
}
