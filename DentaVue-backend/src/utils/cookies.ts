import type { CookieOptions, Request, Response } from 'express'
import { env, isProduction } from '@/config/env.js'

/**
 * The refresh token, kept in an httpOnly cookie so the session survives a page
 * reload.
 *
 * Why the REFRESH token and not the access token: the access token is the
 * working credential the web app sends as a Bearer header, and it lives in
 * memory only (never readable by injected script). The refresh token is the
 * durable secret — httpOnly so no script can read it, and the browser replays it
 * automatically to POST /auth/session, which mints a fresh access token on load.
 *
 * SameSite is env-driven (COOKIE_SAMESITE). 'lax' is enough when the web app and
 * API share a registrable domain (localhost in dev; app.dentavue.io + api.dentavue.io
 * in a custom-domain prod), so the cookie rides the app's cross-origin fetch to
 * the API. When the two are on genuinely different sites — e.g. two Render
 * services on *.onrender.com — it MUST be 'none' (with Secure, on in prod), or
 * the browser drops the cookie and the session won't survive a reload.
 */
const REFRESH_COOKIE = 'dentavue_refresh_token'
const REFRESH_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: isProduction, // over plain http on localhost in dev; HTTPS-only in prod
  sameSite: env.COOKIE_SAMESITE,
  path: '/',
}

export function setRefreshCookie(res: Response, refreshToken: string): void {
  res.cookie(REFRESH_COOKIE, refreshToken, { ...baseCookieOptions, maxAge: REFRESH_MAX_AGE_MS })
}

export function clearRefreshCookie(res: Response): void {
  res.clearCookie(REFRESH_COOKIE, baseCookieOptions)
}

/**
 * Reads the refresh cookie off the request. Parsed by hand rather than pulling
 * in cookie-parser — this is the only cookie the API reads, and res.cookie
 * (which sets them) is built into Express already.
 */
export function readRefreshCookie(req: Request): string | null {
  const header = req.headers.cookie
  if (!header) return null
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim()
    if (name === REFRESH_COOKIE) return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return null
}
