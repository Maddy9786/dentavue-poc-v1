import { z } from 'zod'

/**
 * Request schemas for the auth endpoints (API spec #1–14).
 * Kept out of controllers so the same shape can be reused by tests and jobs.
 *
 * These mirror DentaVue-Web's src/lib/validation.ts, but are not a duplicate of
 * it: the client's copy is a UX affordance that saves a round trip, this one is
 * the actual boundary. Anything past here is treated as trusted, so it must be
 * checked here regardless of what the client did.
 */

/**
 * E.164. The spec's examples are US-format, but Razorpay/MSG91 imply an
 * India-first launch — confirm the target region before tightening this.
 * Supabase requires E.164 for SMS OTP, so the format is enforced, not the country.
 */
const e164 = z
  .string()
  .regex(/^\+[1-9]\d{7,14}$/, 'Phone must be E.164, e.g. +919876543210')

/**
 * DEVIATES FROM THE API SPEC — deliberately.
 *
 * Spec #1 also requires confirmPassword, userType, firstName, lastName and
 * phoneNumber. The Create Account screen has no fields for any of them, and the
 * Figma places a 16-step onboarding AFTER sign-up, which is where they are
 * collected. The spec predates those screens; enforcing it here would make the
 * designed screen impossible to submit.
 *
 * So sign-up creates the account, and onboarding completes the profile:
 *   - userType defaults to `patient`; the persona is chosen during onboarding.
 *   - firstName/lastName land as '' — profiles has defaults for exactly this.
 *   - phoneNumber stays null until the number is verified via OTP.
 *
 * confirmPassword is dropped rather than made optional: the screen has one
 * password field, and a "confirm" the UI never asks for is not validation, just
 * a field that can never disagree.
 *
 * The password rules deliberately mirror DentaVue-Web's getPasswordStrength(), so
 * "Strong Password" on screen means "the API will accept this". Change one and
 * you must change the other.
 */
export const signupSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a number'),
  acceptTerms: z.literal(true, { message: 'Terms must be accepted' }),
  /** Set during onboarding; defaulted so the screen need not ask. */
  userType: z.enum(['patient', 'provider']).default('patient'),
})

/**
 * Sign-in deliberately does NOT apply the sign-up strength rules. Rejecting an
 * existing user's already-accepted password for being "too short" would lock
 * them out, and telling an unauthenticated caller what the rules are is a hint
 * they do not need. Only presence is checked.
 */
export const signinSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1, 'Enter your password'),
})

export const signinPhoneSchema = z.object({
  phoneNumber: e164,
})

export const verifyOtpSchema = z.object({
  phoneNumber: e164,
  otp: z.string().regex(/^\d{6}$/, 'Enter the 6-digit code'),
})

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
})

/**
 * OAuth completion. The frontend relays the tokens Supabase returned in the
 * redirect hash; presence is all that is checked here because the access token
 * is re-validated against Supabase in the service. Anything that is not a
 * genuine token simply fails there.
 */
export const oauthCompleteSchema = z.object({
  accessToken: z.string().min(1),
  refreshToken: z.string().min(1),
})

export type SignupInput = z.infer<typeof signupSchema>
export type SigninInput = z.infer<typeof signinSchema>
export type SigninPhoneInput = z.infer<typeof signinPhoneSchema>
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>
export type OAuthCompleteInput = z.infer<typeof oauthCompleteSchema>
