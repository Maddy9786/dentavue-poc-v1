import express, { type Application } from 'express'
import helmet from 'helmet'
import cors from 'cors'
// Named import, not default: pino-http is CJS and its types expose the callable
// as `pinoHttp`, so a default import resolves to the namespace and is not callable.
import { pinoHttp } from 'pino-http'
import { env } from '@/config/env.js'
import { logger } from '@/config/logger.js'
import v1Routes from '@/routes/v1/index.js'
import { errorHandler, notFoundHandler } from '@/middlewares/errorHandler.js'

/**
 * Builds the Express app without binding a port, so tests can import it and
 * drive it in-process. Listening is server.ts's job.
 */
export function createApp(): Application {
  const app = express()

  app.set('trust proxy', 1)
  app.use(helmet())
  app.use(cors({ origin: env.CORS_ORIGINS, credentials: true }))
  // A guided scan posts up to four base64 images in one body (POST /scans), so
  // the limit is sized for that. Individual images are still capped in the scan
  // validator, and the web app downscales each capture to a small JPEG.
  app.use(express.json({ limit: '8mb' }))
  app.use(express.urlencoded({ extended: true }))
  app.use(pinoHttp({ logger }))

  app.get('/health', (_req, res) => {
    res.status(200).json({ success: true, message: 'ok', data: { status: 'healthy' } })
  })

  app.use(env.API_PREFIX, v1Routes)

  // Order matters: 404 catches unmatched routes, then the error handler.
  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
