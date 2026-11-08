import type { Response } from 'express'

/**
 * The "V" in MVC: presenters that shape every outbound payload.
 *
 * DentaVue_API_Endpoints.md specifies one envelope for all responses,
 * success and error alike:
 *
 *     { "success": true, "message": "...", "data": { ... } }
 *
 * Controllers must return through these helpers rather than calling res.json
 * directly, so the contract holds across every route.
 */

export function sendSuccess<T>(res: Response, message: string, data: T, status = 200): Response {
  return res.status(status).json({ success: true, message, data })
}

export function sendCreated<T>(res: Response, message: string, data: T): Response {
  return sendSuccess(res, message, data, 201)
}

export function sendNoContent(res: Response, message: string): Response {
  return res.status(200).json({ success: true, message, data: null })
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  errors?: Record<string, string[]>,
): Response {
  return res.status(status).json({ success: false, message, ...(errors ? { errors } : {}) })
}
