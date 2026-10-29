import { randomUUID } from 'node:crypto'
import { supabaseAdmin } from '@/config/supabase.js'
import * as scanModel from '@/models/scan.model.js'
import * as analysisService from '@/services/analysis.service.js'
import { ApiError } from '@/utils/ApiError.js'
import { logger } from '@/config/logger.js'
import type { IsoDateTime } from '@/types/domain.js'
import type { CreateScanInput } from '@/validators/scan.validator.js'

/**
 * Scan business logic: decode the uploaded image, store the bytes in Supabase
 * Storage, record the row, and hand back a signed URL the browser can load.
 *
 * Services compose the model and Storage; controllers call services. The bucket
 * is private, so every image the API returns is a short-lived SIGNED url — never
 * a public one (these are personal health images).
 */

const BUCKET = 'scans'
const SIGNED_URL_TTL_SECONDS = 60 * 60 // 1 hour

// The guided-capture order. The client sends images in this order; position i is
// this angle. Keep in sync with the web app's photoCaptureSteps. Extra images
// (should not happen — the validator caps at 4) fall back to a positional name.
const ANGLES = ['front-teeth', 'upper-gums', 'tongue', 'lower-gums'] as const

/** One angle of a scan, with a signed, expiring link to its image. */
export interface ScanImageDto {
  position: number
  angle: string
  imageUrl: string
}

/**
 * What the API returns for a scan. `imageUrl` is the cover (front teeth) — what
 * Compare / AI-insight render; `images` is every angle in capture order (the scan
 * results carousel). All URLs are signed and expiring.
 */
export interface ScanDto {
  id: string
  imageUrl: string
  images: ScanImageDto[]
  capturedAt: IsoDateTime
  score: number | null
  createdAt: IsoDateTime
}

const EXT_BY_TYPE: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/webp': 'webp',
}

/** Splits a base64 image data URL into its content type and raw bytes. */
function decodeDataUrl(dataUrl: string): { contentType: string; ext: string; buffer: Buffer } {
  const match = /^data:(image\/(?:png|jpe?g|webp));base64,(.+)$/i.exec(dataUrl)
  if (!match || !match[1] || !match[2]) {
    throw ApiError.unprocessable('Unsupported image', {
      image: ['Must be a base64-encoded PNG, JPEG or WEBP data URL'],
    })
  }
  const contentType = match[1].toLowerCase()
  const ext = EXT_BY_TYPE[contentType] ?? 'png'
  const buffer = Buffer.from(match[2], 'base64')
  if (buffer.byteLength === 0) {
    throw ApiError.unprocessable('Empty image', { image: ['The image is empty'] })
  }
  return { contentType, ext, buffer }
}

/**
 * Signs one Storage path, or throws. Exported so the analysis controller can
 * render comparison images without analysis.service importing this module (that
 * would be a cycle). Use only where a missing object should fail the request.
 */
export async function signScanImage(storagePath: string): Promise<string> {
  const url = await signImageUrlSafe(storagePath)
  if (!url) throw new ApiError(502, 'Could not prepare the scan image')
  return url
}

/**
 * Signs one Storage path, returning null instead of throwing when the object is
 * gone.
 *
 * This resilience is the whole point: a user's scan history is signed image by
 * image, and `createSignedUrl` errors with "Object not found" for any object
 * that was never stored or was later removed (orphaned rows, an unwound upload,
 * a pre-0004 single-image scan). Previously one such object threw a 502 that
 * failed the ENTIRE `GET /scans` — so a single broken image blanked Home,
 * Compare and AI-insight at once. A per-image null keeps the rest renderable.
 */
async function signImageUrlSafe(storagePath: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin.storage
    .from(BUCKET)
    .createSignedUrl(storagePath, SIGNED_URL_TTL_SECONDS)
  if (error || !data) {
    logger.warn({ err: error, storagePath }, 'Skipping unsignable scan image')
    return null
  }
  return data.signedUrl
}

async function toDto(scan: scanModel.ScanWithImages): Promise<ScanDto> {
  // Sign every angle. Fall back to the cover as the sole image for any scan with
  // no scan_images rows (a pre-0004 single-image scan).
  const entries: scanModel.ScanImage[] = scan.images.length
    ? scan.images
    : [{ position: 0, angle: 'front-teeth', storagePath: scan.storagePath }]

  const signed = await Promise.all(
    entries.map(async (image) => ({
      position: image.position,
      angle: image.angle,
      imageUrl: await signImageUrlSafe(image.storagePath),
    })),
  )

  // Drop angles whose object is gone rather than emitting a broken URL. A scan
  // whose images are ALL missing still returns (with an empty `images` and a
  // blank cover) so it never disappears from the list — the client renders its
  // placeholder for the image and the analysis still shows.
  const images = signed
    .filter((image): image is { position: number; angle: string; imageUrl: string } =>
      image.imageUrl !== null,
    )

  return {
    id: scan.id,
    imageUrl: images[0]?.imageUrl ?? '',
    images,
    capturedAt: scan.capturedAt,
    score: scan.score,
    createdAt: scan.createdAt,
  }
}

/** Best-effort removal of Storage objects — used to undo a failed session. */
async function removeObjects(paths: string[]): Promise<void> {
  if (paths.length === 0) return
  const { error } = await supabaseAdmin.storage.from(BUCKET).remove(paths)
  if (error) logger.error({ err: error, paths }, 'Failed to clean up scan objects')
}

/**
 * Saves a captured scan session: uploads every angle, records the session row
 * (its cover is the first image — front teeth), then records the per-angle rows.
 *
 * Storage has no client transaction, so failures are unwound by hand: if any
 * upload or insert fails, the objects already uploaded — and the session row, if
 * it was created — are removed, so nothing is left half-written.
 *
 * Compare / AI-insight still read one image per scan (the cover), so `toDto` and
 * the read paths are unchanged; the extra angles are stored for a later
 * multi-image analysis flow.
 */
export async function createScan(userId: string, input: CreateScanInput): Promise<ScanDto> {
  // Decode first, so a bad image fails before anything is uploaded.
  const decoded = input.images.map(decodeDataUrl)

  // One id for the session; each angle is an object beneath it.
  const scanId = randomUUID()
  const uploaded: Array<{ position: number; angle: string; storagePath: string }> = []

  for (let position = 0; position < decoded.length; position += 1) {
    const { contentType, ext, buffer } = decoded[position]!
    const storagePath = `${userId}/${scanId}/${position}.${ext}`
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, buffer, { contentType, upsert: false })
    if (uploadError) {
      await removeObjects(uploaded.map((u) => u.storagePath))
      logger.error({ err: uploadError, userId }, 'Scan upload failed')
      throw new ApiError(502, 'Could not store the scan image')
    }
    uploaded.push({ position, angle: ANGLES[position] ?? `angle-${position}`, storagePath })
  }

  // The front-teeth shot (position 0) is the cover the read paths render.
  const coverPath = uploaded[0]!.storagePath

  let scan: scanModel.Scan
  try {
    scan = await scanModel.create({
      id: scanId,
      userId,
      storagePath: coverPath,
      capturedAt: input.capturedAt ?? new Date().toISOString(),
    })
  } catch (err) {
    await removeObjects(uploaded.map((u) => u.storagePath))
    throw err
  }

  try {
    await scanModel.createImages(uploaded.map((u) => ({ scanId, ...u })))
  } catch (err) {
    // Unwind the whole session: drop the objects and the (now imageless) row.
    await removeObjects(uploaded.map((u) => u.storagePath))
    await scanModel.remove(scanId).catch(() => undefined)
    throw err
  }

  const dto = await toDto({
    ...scan,
    images: uploaded.map((u) => ({ position: u.position, angle: u.angle, storagePath: u.storagePath })),
  })

  // Kick off AI analysis WITHOUT awaiting it. The upload responds as soon as the
  // images are safe; the model call takes seconds, and making the user's request
  // wait on it would turn a storage write into a third-party latency problem.
  // runAnalysis never throws — a failure lands in scan_analysis.status, which is
  // what the web app's analysing screen polls. The floating promise is
  // deliberate, hence the explicit void and the catch-of-last-resort.
  void analysisService.runAnalysis(userId, scanId).catch((err: unknown) => {
    logger.error({ err, scanId }, 'Analysis dispatch failed')
  })

  return dto
}

/** The caller's scans, oldest first (newest last), each with a signed URL. */
export async function listScans(userId: string): Promise<ScanDto[]> {
  const scans = await scanModel.listByUser(userId)
  return Promise.all(scans.map(toDto))
}
