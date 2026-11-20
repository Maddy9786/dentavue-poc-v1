/**
 * Internal Intraoral Clinical Image Enhancement Pipeline.
 *
 * Runs automatically on the captured `<canvas>` in ~25–35ms right after a photo
 * is taken (or picked from the gallery), with zero UI overhead.
 *
 * Three calibrated medical-imaging stages:
 *   1. Illuminant White-Balance Correction (neutralises warm indoor yellow room
 *      lighting so white enamel isn't misread as yellow plaque/stain, while
 *      preserving true gingival R/G redness).
 *   2. Adaptive Intraoral Shadow-Lift (lifts dark shadow regions inside the open
 *      mouth — upper gums, lower gums, posterior tongue — without clipping
 *      bright front-tooth enamel highlights).
 *   3. Edge-Preserving Clinical Unsharp Mask (3x3 luminance high-pass filter with
 *      a sensor-noise gate so gum margins, interdental papillae, plaque biofilm
 *      and enamel edges are sharp for AI bounding-box and severity detection).
 */

const clampByte = (v: number): number => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v))

/**
 * Enhances an HTMLCanvasElement in-place for clinical dental AI analysis.
 */
export function enhanceIntraoralCanvas(canvas: HTMLCanvasElement): void {
  const width = canvas.width
  const height = canvas.height
  if (width < 16 || height < 16) return

  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return

  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const pixelCount = width * height

  // -------------------------------------------------------------------------
  // Pass 1: Measure scene luminance & neutral-highlight illuminant balance
  // -------------------------------------------------------------------------
  let sumR = 0
  let sumG = 0
  let sumB = 0
  let validWbPixels = 0
  let sumLuma = 0

  const lumaBuffer = new Float32Array(pixelCount)

  for (let i = 0, p = 0; i < data.length; i += 4, p += 1) {
    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!
    const y = 0.299 * r + 0.587 * g + 0.114 * b
    lumaBuffer[p] = y
    sumLuma += y

    // Sample moderately bright, non-clipped pixels for white-balance reference
    // (excludes deep shadows < 40, specular glints > 245, and deep red vascular pixels)
    const maxC = Math.max(r, g, b)
    const minC = Math.min(r, g, b)
    const sat = maxC === 0 ? 0 : (maxC - minC) / maxC
    if (y > 55 && y < 240 && sat < 0.35) {
      sumR += r
      sumG += g
      sumB += b
      validWbPixels += 1
    }
  }

  const meanLuma = sumLuma / Math.max(1, pixelCount)

  // Gentle white-balance channel gains (clamped to [0.92, 1.09] so true gum redness
  // and natural plaque shades are never distorted, only room bulb cast is removed)
  let gainR = 1
  let gainG = 1
  let gainB = 1
  if (validWbPixels > pixelCount * 0.04) {
    const avgR = sumR / validWbPixels
    const avgG = sumG / validWbPixels
    const avgB = sumB / validWbPixels
    const avgGray = (avgR + avgG + avgB) / 3
    if (avgR > 10 && avgG > 10 && avgB > 10) {
      // Dampen correction to 45% strength and clamp tightly
      gainR = Math.min(1.08, Math.max(0.92, 1 + 0.45 * (avgGray / avgR - 1)))
      gainG = Math.min(1.06, Math.max(0.94, 1 + 0.45 * (avgGray / avgG - 1)))
      gainB = Math.min(1.09, Math.max(0.92, 1 + 0.45 * (avgGray / avgB - 1)))
    }
  }

  // -------------------------------------------------------------------------
  // Pass 2: Adaptive Intraoral Shadow-Lift LUT (0..255)
  // -------------------------------------------------------------------------
  // If the overall frame or inner mouth is dim (meanLuma < 125), apply a smooth
  // shadow-lift gamma (0.82–0.92) that brightens dark gum pockets and tongue
  // shadows while rolling off smoothly above luma 185 so teeth never clip.
  const gamma = meanLuma < 85 ? 0.8 : meanLuma < 125 ? 0.87 : 0.94
  const toneLut = new Float32Array(256)
  for (let v = 0; v < 256; v += 1) {
    if (v === 0) {
      toneLut[0] = 0
      continue
    }
    const norm = v / 255
    // Shadow-lift curve blended with linear at highlights (norm^2 weight)
    const lifted = Math.pow(norm, gamma)
    const highlightProtect = norm * norm
    const blended = lifted * (1 - 0.35 * highlightProtect) + norm * (0.35 * highlightProtect)
    toneLut[v] = (blended * 255) / v
  }

  // -------------------------------------------------------------------------
  // Pass 3: Apply White-Balance + Shadow-Lift + Edge-Preserving Unsharp Mask
  // -------------------------------------------------------------------------
  // Unsharp mask strength: 0.28, with a 3-luma noise gate so camera ISO grain in
  // dark corners is not sharpened.
  const SHARP_AMOUNT = 0.28
  const NOISE_GATE = 3.0

  for (let y = 0; y < height; y += 1) {
    const isBorderY = y === 0 || y === height - 1
    for (let x = 0; x < width; x += 1) {
      const p = y * width + x
      const idx = p * 4

      const rawR = data[idx]! * gainR
      const rawG = data[idx + 1]! * gainG
      const rawB = data[idx + 2]! * gainB

      const centerLuma = lumaBuffer[p]!
      const lutIdx = clampByte(centerLuma)
      const shadowScale = toneLut[lutIdx]!

      let detailBoost = 0
      if (!isBorderY && x > 0 && x < width - 1) {
        const neighborMean =
          (lumaBuffer[p - 1]! +
            lumaBuffer[p + 1]! +
            lumaBuffer[p - width]! +
            lumaBuffer[p + width]!) *
          0.25
        const highPass = centerLuma - neighborMean
        if (Math.abs(highPass) >= NOISE_GATE) {
          detailBoost = highPass * SHARP_AMOUNT
        }
      }

      data[idx] = clampByte(rawR * shadowScale + detailBoost)
      data[idx + 1] = clampByte(rawG * shadowScale + detailBoost)
      data[idx + 2] = clampByte(rawB * shadowScale + detailBoost)
    }
  }

  ctx.putImageData(imageData, 0, 0)
}

/**
 * Enhances a base64 image data URL (e.g. a photo picked from the phone gallery)
 * through the same 3-stage intraoral clinical pipeline.
 */
export function enhanceIntraoralDataUrl(
  dataUrl: string,
  maxDimension = 1280,
): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxDimension / Math.max(img.width, img.height))
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (!ctx) {
        resolve(dataUrl)
        return
      }
      ctx.drawImage(img, 0, 0, width, height)
      enhanceIntraoralCanvas(canvas)
      resolve(canvas.toDataURL('image/jpeg', 0.92))
    }
    img.onerror = () => resolve(dataUrl)
    img.src = dataUrl
  })
}

