import { z } from 'zod'

/**
 * Request schema for saving a captured scan session.
 *
 * No endpoint is specified for this in the API doc (the spec stops mid-way — see
 * CLAUDE.md's coverage gap), so this is a designed contract. A guided scan is up
 * to four framed images (front teeth → upper gums → tongue → lower gums), each a
 * base64 data URL straight off the browser's camera canvas, sent **in capture
 * order** — the service maps position → angle from that order and stores every
 * one, using the first (front teeth) as the cover.
 *
 * Each image is length-capped as a guard; the app downscales every capture to a
 * small JPEG, and the JSON body limit in app.ts (raised to cover four images) is
 * the real ceiling. `capturedAt` is optional; the service stamps `now()` when
 * it's absent.
 */
const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpe?g|webp);base64,/i, 'Must be a base64 image data URL')
  .max(1_500_000, 'Image is too large')

export const createScanSchema = z.object({
  images: z
    .array(imageDataUrl)
    .min(1, 'At least one image is required')
    .max(4, 'A scan has at most four images'),
  capturedAt: z.string().datetime().optional(),
})

export type CreateScanInput = z.infer<typeof createScanSchema>

/**
 * Path params for the per-scan analysis routes.
 *
 * Validating the uuid shape here means a malformed id is a clean 422 rather
 * than reaching Postgres and coming back as an opaque driver error.
 */
export const scanIdParamsSchema = z.object({
  scanId: z.string().uuid('Must be a valid scan id'),
})
