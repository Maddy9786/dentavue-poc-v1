import { Router } from 'express'
import * as scanController from '@/controllers/scan.controller.js'
import { validate } from '@/middlewares/validate.js'
import { authenticate } from '@/middlewares/authenticate.js'
import { scanUploadLimiter, analysisLimiter } from '@/middlewares/rateLimit.js'
import { createScanSchema, scanIdParamsSchema } from '@/validators/scan.validator.js'

/**
 * Scan routes.
 *
 * Not in the API spec (it stops before scans — see CLAUDE.md); designed here.
 * Every route `authenticate`s first, so the scans a caller saves and reads are
 * their own (the user id comes from the verified token, never the path or the
 * body — a scan uuid in the URL is not proof of ownership, and the service-role
 * key bypasses RLS, so the database will not catch a mistake here).
 *
 * ORDER MATTERS: `/comparison` is declared before `/:scanId/...`, or Express
 * matches the literal word "comparison" as a scan id and the route 404s on a
 * uuid parse instead of running.
 */
const router = Router()

router.post(
  '/',
  authenticate,
  scanUploadLimiter,
  validate({ body: createScanSchema }),
  scanController.createScan,
)
router.get('/', authenticate, scanController.listScans)

// Pure arithmetic over two stored analyses — no model call, so no limiter.
router.get('/comparison', authenticate, scanController.getComparison)

// Polled by the analysing screen while a scan is in flight, so it is cheap and
// unthrottled: it is a database read, and throttling it would stall the screen.
router.get(
  '/:scanId/analysis',
  authenticate,
  validate({ params: scanIdParamsSchema }),
  scanController.getAnalysis,
)

// Re-analysis DOES spend money on the model, so it is limited per account.
router.post(
  '/:scanId/analysis',
  authenticate,
  analysisLimiter,
  validate({ params: scanIdParamsSchema }),
  scanController.reanalyse,
)

export default router
