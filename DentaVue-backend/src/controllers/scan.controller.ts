import type { Request, Response } from 'express'
import * as scanService from '@/services/scan.service.js'
import * as analysisService from '@/services/analysis.service.js'
import { sendSuccess, sendCreated } from '@/views/response.js'
import { ApiError } from '@/utils/ApiError.js'
import type { CreateScanInput } from '@/validators/scan.validator.js'

/**
 * Scan controller — thin HTTP glue. Input is validated by middleware and the
 * caller is authenticated (see the route); Express 5 forwards rejected promises
 * to errorHandler, so no try/catch here.
 *
 * The user id always comes from the verified token, never the body, so one user
 * cannot save or read another's scans.
 */

/** POST /scans — save the caller's captured scan. */
export async function createScan(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const scan = await scanService.createScan(req.user.userId, req.body as CreateScanInput)
  return sendCreated(res, 'Scan saved successfully', scan)
}

/** GET /scans — the caller's scans, oldest first. */
export async function listScans(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const scans = await scanService.listScans(req.user.userId)
  return sendSuccess(res, 'Scans retrieved successfully', scans)
}

/**
 * GET /scans/comparison — baseline vs. latest.
 *
 * Declared BEFORE the /:scanId routes in scan.routes.ts, or Express matches
 * "comparison" as a scan id. Returns null-data when the caller has no scans.
 */
export async function getComparison(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const comparison = await analysisService.getComparison(
    req.user.userId,
    scanService.signScanImage,
  )
  return sendSuccess(res, 'Comparison retrieved successfully', comparison)
}

/**
 * GET /scans/:scanId/analysis — the AI result for one scan.
 *
 * Polled by the analysing screen, so it answers `pending` (not 404) while the
 * model is still working, and `failed` with a short reason when it gave up.
 */
export async function getAnalysis(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const analysis = await analysisService.getAnalysis(req.user.userId, req.params.scanId as string)
  return sendSuccess(res, 'Analysis retrieved successfully', analysis)
}

/**
 * POST /scans/:scanId/analysis — re-run analysis for a scan.
 *
 * The retry behind a failed analysis. Awaited rather than fired-and-forgotten:
 * the caller asked for it explicitly and is waiting on the answer, unlike the
 * upload path where analysis is a side effect.
 */
export async function reanalyse(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const scanId = req.params.scanId as string
  await analysisService.reanalyse(req.user.userId, scanId)
  const analysis = await analysisService.getAnalysis(req.user.userId, scanId)
  return sendSuccess(res, 'Analysis complete', analysis)
}
