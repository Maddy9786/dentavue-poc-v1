import type { Request, Response } from 'express'
import * as authService from '@/services/auth.service.js'
import { sendCreated, sendNoContent, sendSuccess } from '@/views/response.js'
import { ApiError } from '@/utils/ApiError.js'
import { env } from '@/config/env.js'
import { logger } from '@/config/logger.js'
import { clearRefreshCookie, readRefreshCookie, setRefreshCookie } from '@/utils/cookies.js'
import type {
  OAuthCompleteInput,
  RefreshTokenInput,
  SigninInput,
  SigninPhoneInput,
  SignupInput,
  VerifyOtpInput,
} from '@/validators/auth.validator.js'

/**
 * The "C" in MVC: translate HTTP to service calls and back.
 *
 * Controllers stay thin — no business rules, no database access. Input is
 * already validated by middleware; output goes through the view helpers so
 * every response keeps the same envelope. No try/catch needed: Express 5
 * forwards rejected promises to errorHandler.
 */

export async function signup(req: Request, res: Response): Promise<Response> {
  const result = await authService.signup(req.body as SignupInput)
  // Persist the session across reloads: the refresh token rides in an httpOnly
  // cookie, POST /auth/session mints a fresh access token from it on load.
  setRefreshCookie(res, result.refreshToken)
  return sendCreated(res, 'Account created successfully', result)
}

export async function signin(req: Request, res: Response): Promise<Response> {
  const session = await authService.signin(req.body as SigninInput)
  setRefreshCookie(res, session.refreshToken)
  return sendSuccess(res, 'Signed in successfully', session)
}

export async function signinPhone(req: Request, res: Response): Promise<Response> {
  const result = await authService.signinPhone(req.body as SigninPhoneInput)
  return sendSuccess(res, 'Verification code sent', result)
}

/**
 * Resend is the same operation as request — Supabase invalidates the previous
 * code and sends a new one. It exists as its own route because the spec lists
 * it (#7) and because the two deserve separate rate limits.
 */
export async function resendPhoneOtp(req: Request, res: Response): Promise<Response> {
  const result = await authService.signinPhone(req.body as SigninPhoneInput)
  return sendSuccess(res, 'Verification code resent', result)
}

export async function verifyPhoneOtp(req: Request, res: Response): Promise<Response> {
  const session = await authService.verifyPhoneOtp(req.body as VerifyOtpInput)
  setRefreshCookie(res, session.refreshToken)
  return sendSuccess(res, 'Phone verified successfully', session)
}

export async function refreshToken(req: Request, res: Response): Promise<Response> {
  const { refreshToken: token } = req.body as RefreshTokenInput
  const session = await authService.refreshToken(token)
  // Supabase rotates the refresh token on every refresh — keep the cookie in step.
  setRefreshCookie(res, session.refreshToken)
  return sendSuccess(res, 'Token refreshed', session)
}

/**
 * POST /auth/session — restore the session on page load.
 *
 * There is no Authorization header after a reload (the access token lived in
 * memory), so this reads the refresh cookie and exchanges it for a fresh
 * session, rotating the cookie. A missing cookie is simply "not signed in".
 *
 * Only a genuinely invalid/expired refresh token (401) clears the cookie; a
 * transient upstream failure (5xx) leaves it in place so a blip doesn't sign the
 * user out.
 */
export async function restoreSession(req: Request, res: Response): Promise<Response> {
  const token = readRefreshCookie(req)
  if (!token) throw ApiError.unauthorized('No active session')

  let session
  try {
    session = await authService.refreshToken(token)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) clearRefreshCookie(res)
    throw err
  }

  setRefreshCookie(res, session.refreshToken)
  return sendSuccess(res, 'Session restored', session)
}

/**
 * Starts Google sign-in. Unlike every other handler here this returns a 302, not
 * the JSON envelope: the browser navigates to this URL directly, so the response
 * has to be a redirect it can follow, not a body it would just display.
 *
 * It therefore owns its own error handling instead of letting the error handler
 * emit JSON — a raw error envelope rendered in the address bar helps nobody. On
 * failure it bounces back to the frontend callback with ?error, which shows a
 * friendly message. This is the one place a try/catch is right.
 */
export async function googleSignin(_req: Request, res: Response): Promise<void> {
  try {
    const url = await authService.getOAuthUrl('google')
    res.redirect(302, url)
  } catch (err) {
    logger.error({ err }, 'Failed to start Google OAuth')
    res.redirect(302, `${env.WEB_APP_URL}/auth/callback?error=oauth_start_failed`)
  }
}

/**
 * Finishes OAuth: the frontend posts the tokens from the redirect hash and gets
 * back a normal session envelope, identical to what /signin returns.
 */
export async function oauthComplete(req: Request, res: Response): Promise<Response> {
  const { accessToken, refreshToken } = req.body as OAuthCompleteInput
  const session = await authService.completeOAuth(accessToken, refreshToken)
  setRefreshCookie(res, session.refreshToken)
  return sendSuccess(res, 'Signed in successfully', session)
}

export async function logout(req: Request, res: Response): Promise<Response> {
  // authenticate ran before this, so the token is present and valid.
  if (!req.accessToken) throw ApiError.unauthorized()
  await authService.logout(req.accessToken)
  clearRefreshCookie(res)
  return sendNoContent(res, 'Logged out successfully')
}
