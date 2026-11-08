import { createApp } from './app.js'
import { env } from './config/env.js'
import { logger } from './config/logger.js'

const app = createApp()

const server = app.listen(env.PORT, () => {
  logger.info(`DentaVue backend listening on http://localhost:${env.PORT}${env.API_PREFIX}`)
})

/**
 * Drain in-flight requests before exiting so a deploy doesn't cut off a
 * booking or payment mid-write.
 */
function shutdown(signal: string): void {
  logger.info(`${signal} received, shutting down`)
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })

  setTimeout(() => {
    logger.error('Forced shutdown after 10s timeout')
    process.exit(1)
  }, 10_000).unref()
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))

process.on('unhandledRejection', (reason) => {
  logger.error({ reason }, 'Unhandled promise rejection')
})
