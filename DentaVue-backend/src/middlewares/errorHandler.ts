import type { NextFunction, Request, Response } from 'express'
import { ZodError, z } from 'zod'
import { ApiError } from '@/utils/ApiError.js'
import { sendError } from '@/views/response.js'
import { logger } from '@/config/logger.js'
import { isProduction } from '@/config/env.js'

/** 404 for unmatched routes. Mount after all routes, before errorHandler. */
export function notFoundHandler(req: Request, res: Response): Response {
  return sendError(res, 404, `Route not found: ${req.method} ${req.originalUrl}`)
}

/**
 * Terminal error middleware. Express 5 forwards rejected async handlers here
 * automatically, so route handlers don't need try/catch to reach it.
 */
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  // Unused, but required: Express identifies an error handler by its 4-argument
  // arity. Drop this parameter and it silently becomes ordinary middleware that
  // never runs. The leading underscore satisfies the unused-args rule.
  _next: NextFunction,
): Response {
  if (err instanceof ApiError) {
    return sendError(res, err.status, err.message, err.errors)
  }

  if (err instanceof ZodError) {
    const flattened = z.flattenError(err)
    return sendError(res, 422, 'Validation failed', flattened.fieldErrors as Record<string, string[]>)
  }

  // Anything else is an unhandled bug: log it in full, tell the client nothing.
  logger.error({ err }, 'Unhandled error')
  return sendError(res, 500, isProduction ? 'Internal server error' : String(err))
}
