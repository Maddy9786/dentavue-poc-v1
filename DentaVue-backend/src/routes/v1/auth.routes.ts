import { Router } from 'express'
import * as authController from '@/controllers/auth.controller.js'
import { validate } from '@/middlewares/validate.js'
import { authenticate } from '@/middlewares/authenticate.js'
import {
  oauthLimiter,
  otpLimiter,
  refreshLimiter,
  signinAccountLimiter,
  signinLimiter,
  signupLimiter,
  verifyOtpLimiter,
} from '@/middlewares/rateLimit.js'
import {
  oauthCompleteSchema,
  refreshTokenSchema,
  signinPhoneSchema,
  signinSchema,
  signupSchema,
  verifyOtpSchema,
} from '@/validators/auth.validator.js'

/**
 * Auth routes (API spec #1–14). Routes wire path + middleware + controller and
 * contain no logic of their own.
 *
 * RATE LIMITING — every unauthenticated route here is limited; see
 * middlewares/rateLimit.ts for the reasoning and for the in-memory-store caveat
 * that must be resolved (Redis) before running more than one instance.
 *
 * Order is deliberate: limiter BEFORE validate. Rejecting a flood should cost a
 * counter increment, not a full zod parse of an attacker-supplied body.
 * /signin is the exception — signinAccountLimiter keys on req.body.email, so
 * express.json() must have parsed the body, which it has by app.ts.
 */
const router = Router()

router.post('/signup', signupLimiter, validate({ body: signupSchema }), authController.signup)

// Two limiters, one route: per-IP catches one source hammering many accounts,
// per-account catches many sources hammering one. Neither alone is enough.
router.post(
  '/signin',
  signinLimiter,
  signinAccountLimiter,
  validate({ body: signinSchema }),
  authController.signin,
)

router.post(
  '/signin-phone',
  otpLimiter,
  validate({ body: signinPhoneSchema }),
  authController.signinPhone,
)
router.post(
  '/resend-phone-otp',
  otpLimiter,
  validate({ body: signinPhoneSchema }),
  authController.resendPhoneOtp,
)
router.post(
  '/verify-phone-otp',
  verifyOtpLimiter,
  validate({ body: verifyOtpSchema }),
  authController.verifyPhoneOtp,
)

router.post(
  '/refresh-token',
  refreshLimiter,
  validate({ body: refreshTokenSchema }),
  authController.refreshToken,
)

// Restore the session on page load from the refresh cookie — no body, no
// Authorization header (the access token was in-memory and is gone). Shares the
// refresh limiter: it runs the same refresh underneath.
router.post('/session', refreshLimiter, authController.restoreSession)

// OAuth. `GET /google` is a browser navigation that 302s to Google's consent
// screen (no validate: no body); `/oauth/complete` takes the tokens the redirect
// hands back and returns a session. Apple would be a sibling GET /apple.
router.get('/google', oauthLimiter, authController.googleSignin)
router.post(
  '/oauth/complete',
  oauthLimiter,
  validate({ body: oauthCompleteSchema }),
  authController.oauthComplete,
)

// The only auth route requiring a session — you must be signed in to sign out.
router.post('/logout', authenticate, authController.logout)

// TODO — remaining auth endpoints from the spec:
// POST /verify-email, /resend-verification-email, /forgot-password,
// /reset-password, /change-password
// Google is wired (GET /google + /oauth/complete, implicit flow). Apple is a
// deliberate future feature — the web app shows a "coming soon" message rather
// than a dead button, so add GET /apple here when it is built.

export default router
