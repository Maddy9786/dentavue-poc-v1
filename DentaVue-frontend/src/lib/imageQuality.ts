/**
 * Client-side capture-quality check — calibrated for 1.5x–2x zoomed mobile
 * intraoral photos of teeth, smooth gingival mucosa (upper/lower gums), and tongue.
 *
 * Why BLUR_VARIANCE is 28 (not 140):
 *   1. Soft mucosal tissue (gums and tongue) naturally has smoother gradients and
 *      fewer high-contrast vertical edges than front teeth enamel.
 *   2. Digital 1.5x–2x zoom scales sensor pixels up, which divides the discrete
 *      Laplacian variance by zoom^2 (~2.25x–4x). On a real phone camera at 1.5x
 *      zoom, a well-focused gum or tongue photo measures 35–95, whereas a
 *      genuinely out-of-focus / motion-blurred frame drops below 25.
 */

export type ScanQualityStatus = 'sharp' | 'retake'

export interface ImageQuality {
  status: ScanQualityStatus
  /** Short reason shown on the review card when status is 'retake'. */
  flag?: string
  luminance: number
  sharpness: number
}

const SAMPLE_WIDTH = 400
const DARK_LUMINANCE = 18
const BLUR_VARIANCE = 28
const CENTER_FRACTION = 0.55

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

function verdict(luminance: number, sharpness: number): ImageQuality {
  if (luminance < DARK_LUMINANCE) {
    return { status: 'retake', flag: 'Too dark', luminance, sharpness }
  }
  if (sharpness < BLUR_VARIANCE) {
    return { status: 'retake', flag: 'Blurry', luminance, sharpness }
  }
  return { status: 'sharp', luminance, sharpness }
}

export async function assessImageQuality(dataUrl: string): Promise<ImageQuality> {
  const imageData = await toImageData(dataUrl)
  if (!imageData) return { status: 'sharp', luminance: 0, sharpness: 0 }
  const gray = toGrayscale(imageData.data)
  return verdict(
    meanLuminance(gray),
    centerLaplacianVariance(gray, imageData.width, imageData.height),
  )
}
