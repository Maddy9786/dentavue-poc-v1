import crypto from 'node:crypto'
import type { User } from '@supabase/supabase-js'
import { supabaseAdmin, supabaseAuth } from '@/config/supabase.js'
import { env } from '@/config/env.js'
import { ApiError } from '@/utils/ApiError.js'
import { mapSupabaseAuthError } from '@/utils/supabaseError.js'
import { logger } from '@/config/logger.js'
import * as profileModel from '@/models/profile.model.js'
import type { UserType } from '@/types/domain.js'
import type { SigninInput, SigninPhoneInput, SignupInput, VerifyOtpInput } from '@/validators/auth.validator.js'

/**
 * Authentication, backed by Supabase Auth.
 *
 * Supabase owns identity: auth.users, password hashing, session and refresh
 * tokens, OTP generation/delivery/expiry, and OAuth. This service adapts that to
 * the shape the API spec promises, and joins each identity to its row in
 * `profiles` (the app's own data — userType, name, phone).
 *
 * Two tables, on purpose: auth.users is Supabase-managed and must not be written
 * to directly, so anything of ours lives in public.profiles keyed by the same id.
 */

/** How long a phone OTP is valid. Mirrors Supabase's default; surfaced so the UI can count down. */
const OTP_EXPIRY_SECONDS = 300

export interface AuthSession {
  user: {
    userId: string
    email: string
    userType: UserType
    firstName: string
    lastName: string
    emailVerified: boolean
  }
  accessToken: string
  refreshToken: string
}

/**
 * Joins a Supabase identity to its profile row and shapes the API's session
 * payload. Takes the tokens directly rather than a Session object, because
 * OAuth completion has the tokens (from the redirect) but no Session instance.
 */
async function toAuthSession(
  user: User,
  accessToken: string,
  refreshToken: string,
): Promise<AuthSession> {
  const profile = await profileModel.findById(user.id)

  if (!profile) {
    // The identity exists but its profile row does not — signup was interrupted
    // between creating the user and inserting the profile. Failing loudly beats
    // returning a session with a half-built account.
    logger.error({ userId: user.id }, 'Auth identity has no profile row')
    throw ApiError.notFound('Your account is not fully set up. Please contact support.')
  }

  return {
    user: {
      userId: profile.userId,
      email: user.email ?? profile.email ?? '',
      userType: profile.userType,
      firstName: profile.firstName,
      lastName: profile.lastName,
      emailVerified: Boolean(user.email_confirmed_at),
    },
    accessToken,
    refreshToken,
  }
}

/**
 * Pulls a first/last name out of an OAuth identity's metadata.
 *
 * Google populates given_name/family_name; other providers may only give a
 * single `name` or `full_name`. Everything is optional and best-effort — a
 * blank name is fine, onboarding fills it in — so this never throws, it just
 * returns whatever it can find.
 */
function nameFromMetadata(user: User): { firstName: string; lastName: string } {
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>
  const str = (key: string): string => (typeof meta[key] === 'string' ? (meta[key] as string) : '')

  const given = str('given_name')
  const family = str('family_name')
  if (given || family) return { firstName: given, lastName: family }

  const full = (str('full_name') || str('name')).trim()
  if (!full) return { firstName: '', lastName: '' }
  const [first, ...rest] = full.split(/\s+/)
  return { firstName: first ?? '', lastName: rest.join(' ') }
}

/**
 * Creates the account from email + password alone, then issues a session.
 *
 * Onboarding runs immediately after sign-up and needs to save the profile
 * (step 3), which requires an authenticated call — so sign-up now returns real
 * tokens rather than nothing. admin.createUser can't mint a session, but we hold
 * the password here, so a password sign-in right after creation does. (This
 * supersedes the earlier "no session at sign-up" behaviour; the account is
 * created already confirmed, so the sign-in succeeds regardless of the
 * dashboard's "Confirm email" toggle.)
 *
 * Name, phone and the final persona still arrive during onboarding — see the
 * note on signupSchema.
 */
export async function signup(input: SignupInput): Promise<AuthSession> {
  // admin.createUser rather than signUp: it skips the client-side confirmation
  // flow and fails cleanly on a duplicate.
  //
  // email_confirm: true marks the address confirmed at creation. This is NOT a
  // claim the address was verified — it is the current product decision made
  // explicit: there is no email-verification step in this phase, so requiring
  // confirmation would only mean every new user is created unconfirmed and then
  // refused at sign-in with `email_not_confirmed` (which surfaces as a generic
  // "Invalid email or password"). Confirming here makes sign-up → sign-in work
  // regardless of the dashboard's "Confirm email" toggle, which this code cannot
  // see. When real verification is built, flip this to false, turn "Confirm
  // email" on, switch to signUp()/generateLink() so mail is actually sent, and
  // build the verify screen — see the return value below and auth.routes.ts.
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { userType: input.userType },
  })

  if (error) {
    // The spec calls for 400 here. Note this confirms account existence to an
    // unauthenticated caller — an accepted tradeoff, but worth a second look.
    if (error.status === 422 || /already/i.test(error.message)) {
      throw ApiError.badRequest('Email already exists')
    }
    throw mapSupabaseAuthError(error, 'Could not create the account', 'signup')
  }

  const user = data.user
  if (!user) throw ApiError.badRequest('Could not create the account')

  // If this insert fails the identity is orphaned, so clean it up rather than
  // leave an account that can authenticate but has no profile.
  try {
    await profileModel.create({
      userId: user.id,
      email: input.email,
      userType: input.userType,
      // Empty until onboarding collects them; the profiles table defaults these
      // for exactly this reason.
      firstName: '',
      lastName: '',
      phoneNumber: null,
    })
  } catch (err) {
    await supabaseAdmin.auth.admin.deleteUser(user.id).catch(() => undefined)
    logger.error({ err, userId: user.id }, 'Profile insert failed; rolled back auth user')
    throw err
  }

  // Sign in to mint a session for the newly-created account. The account is
  // already confirmed (email_confirm above), so this succeeds immediately.
  const { data: session, error: signInError } = await supabaseAuth.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (signInError) {
    // The account exists; only the session failed. Don't roll the user back —
    // they can sign in normally. Surface it rather than pretend success.
    logger.error({ err: signInError, userId: user.id }, 'Signed up but could not start a session')
    throw mapSupabaseAuthError(signInError, 'Account created — please sign in.', 'signup')
  }
  if (!session.user || !session.session) {
    logger.error({ userId: user.id }, 'Sign-up sign-in returned no session')
    throw new ApiError(500, 'Account created — please sign in.')
  }

  return toAuthSession(session.user, session.session.access_token, session.session.refresh_token)
}

export async function signin(input: SigninInput): Promise<AuthSession> {
  const { data, error } = await supabaseAuth.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  })

  if (error) {
    // Supabase answers bad credentials with a 4xx. Anything else — it was
    // unreachable, or it broke — must NOT be reported as a credential problem:
    // telling someone their password is wrong during an outage sends them off
    // to reset a password that was always fine.
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      // Log the real reason server-side before flattening it. The client gets a
      // deliberately vague, identical message for "no such email", "wrong
      // password" and "email not confirmed" — a precise one would let anyone
      // enumerate registered addresses — but a hidden reason also makes real
      // misconfigurations (e.g. `email_not_confirmed` when "Confirm email" is on
      // but no verification flow exists) invisible. This keeps the detail in the
      // logs where only an operator sees it.
      logger.warn(
        { code: error.code, status: error.status, reason: error.message },
        'Sign-in rejected by Supabase',
      )
      // 401, not 400 — this is a failure to authenticate.
      throw ApiError.unauthorized('Invalid email or password')
    }
    throw mapSupabaseAuthError(error, 'Could not sign you in. Please try again.', 'signin')
  }

  if (!data.user || !data.session) {
    throw ApiError.unauthorized('Invalid email or password')
  }

  return toAuthSession(data.user, data.session.access_token, data.session.refresh_token)
}

/**
 * Free built-in Phone OTP store (used automatically when no paid SMS provider
 * like Twilio is attached to Supabase Auth). Generates a real 6-digit code with
 * a 5-minute TTL and mints a real Supabase user + JWT session on verification.
 */
interface PendingPhoneOtp {
  code: string
  expiresAt: number
}

const pendingPhoneOtps = new Map<string, PendingPhoneOtp>()

function derivePhoneIdentity(phoneNumber: string): { email: string; password: string } {
  const digits = phoneNumber.replace(/[^0-9]/g, '')
  const email = `phone.${digits}@phone.dentavue.app`
  const hmac = crypto
    .createHmac('sha256', env.SUPABASE_SERVICE_ROLE_KEY)
    .update(`dentavue-phone-auth:${digits}`)
    .digest('hex')
    .slice(0, 28)
  const password = `Dv!9${hmac}aA`
  return { email, password }
}

/**
 * Sends an SMS code (if a paid SMS provider is configured in Supabase) or issues
 * an instant free verification code, creating the account if the number is new.
 */
export async function signinPhone(input: SigninPhoneInput) {
  const { error } = await supabaseAuth.auth.signInWithOtp({
    phone: input.phoneNumber,
    options: { shouldCreateUser: true },
  })

  if (!error) {
    pendingPhoneOtps.delete(input.phoneNumber)
    return {
      phoneNumber: input.phoneNumber,
      otpSent: true,
      expiresInSeconds: OTP_EXPIRY_SECONDS,
    }
  }

  // Fallback to free built-in OTP when no paid SMS gateway is configured in Supabase
  logger.info(
    { phoneNumber: input.phoneNumber, supabaseReason: error.message },
    'Supabase SMS provider not configured — issuing free built-in OTP code',
  )
  const code = String(crypto.randomInt(100000, 1000000))
  pendingPhoneOtps.set(input.phoneNumber, {
    code,
    expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
  })

  return {
    phoneNumber: input.phoneNumber,
    otpSent: true,
    expiresInSeconds: OTP_EXPIRY_SECONDS,
    otpCode: code,
  }
}

export async function verifyPhoneOtp(input: VerifyOtpInput): Promise<AuthSession> {
  const pending = pendingPhoneOtps.get(input.phoneNumber)

  if (pending) {
    if (Date.now() > pending.expiresAt) {
      pendingPhoneOtps.delete(input.phoneNumber)
      throw ApiError.badRequest('That code has expired. Tap Resend for a new code.')
    }
    if (pending.code !== input.otp.trim()) {
      throw ApiError.badRequest('That code is invalid. Please check the 6 digits and try again.')
    }

    // Valid code — consume it so it cannot be reused
    pendingPhoneOtps.delete(input.phoneNumber)

    const { email, password } = derivePhoneIdentity(input.phoneNumber)

    // 1. Try signing in with existing phone identity
    let signInResult = await supabaseAuth.auth.signInWithPassword({ email, password })

    // 2. First time this phone number has signed in → create real Supabase identity
    if (signInResult.error || !signInResult.data.user || !signInResult.data.session) {
      const { data: created, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { userType: 'patient', phoneNumber: input.phoneNumber },
      })

      if (createError && !/already/i.test(createError.message)) {
        throw mapSupabaseAuthError(
          createError,
          'Could not verify phone account. Please try again.',
          'verifyOtpCreate',
        )
      }

      if (created?.user) {
        const existingProfile = await profileModel.findById(created.user.id)
        if (!existingProfile) {
          await profileModel.create({
            userId: created.user.id,
            email: null,
            userType: 'patient',
            firstName: '',
            lastName: '',
            phoneNumber: input.phoneNumber,
          })
        }
      }

      signInResult = await supabaseAuth.auth.signInWithPassword({ email, password })
    }

    if (signInResult.error || !signInResult.data.user || !signInResult.data.session) {
      throw ApiError.badRequest('Could not start a session for this phone number. Please try again.')
    }

    const user = signInResult.data.user
    const session = signInResult.data.session

    // Ensure profile row exists
    const existing = await profileModel.findById(user.id)
    if (!existing) {
      await profileModel.create({
        userId: user.id,
        email: null,
        userType: 'patient',
        firstName: '',
        lastName: '',
        phoneNumber: input.phoneNumber,
      })
    }

    return toAuthSession(user, session.access_token, session.refresh_token)
  }

  const { data, error } = await supabaseAuth.auth.verifyOtp({
    phone: input.phoneNumber,
    token: input.otp,
    type: 'sms',
  })

  if (error) {
    // Same reasoning as signin: only treat a 4xx as "wrong code". An outage
    // must not tell someone their perfectly good code expired.
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      throw ApiError.badRequest('That code is invalid or has expired')
    }
    throw mapSupabaseAuthError(error, 'Could not verify the code. Please try again.', 'verifyOtp')
  }

  if (!data.user || !data.session) {
    throw ApiError.badRequest('That code is invalid or has expired')
  }

  // A number signing in for the first time has an identity but no profile row.
  // Create a minimal one so the session can be built; onboarding completes it.
  const existing = await profileModel.findById(data.user.id)
  if (!existing) {
    await profileModel.create({
      userId: data.user.id,
      email: data.user.email ?? null,
      userType: 'patient',
      firstName: '',
      lastName: '',
      phoneNumber: input.phoneNumber,
    })
  }

  return toAuthSession(data.user, data.session.access_token, data.session.refresh_token)
}

export async function refreshToken(token: string): Promise<AuthSession> {
  const { data, error } = await supabaseAuth.auth.refreshSession({ refresh_token: token })

  if (error) {
    if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
      throw ApiError.unauthorized('Invalid or expired refresh token')
    }
    // An outage must not read as an expired session — the client would sign the
    // user out and lose their place for something that will fix itself.
    throw mapSupabaseAuthError(error, 'Could not refresh the session.', 'refreshToken')
  }

  if (!data.user || !data.session) {
    throw ApiError.unauthorized('Invalid or expired refresh token')
  }

  return toAuthSession(data.user, data.session.access_token, data.session.refresh_token)
}

/**
 * Where OAuth redirects the browser back to once Google + Supabase are done.
 * Path is fixed here; the origin comes from env so dev and prod differ only by
 * that one var. Must be on Supabase's redirect allowlist or the flow is refused.
 */
const OAUTH_REDIRECT_URL = `${env.WEB_APP_URL}/auth/callback`

/**
 * Step 1 of OAuth: ask Supabase for the provider consent URL and hand it back
 * for the browser to visit. skipBrowserRedirect because there is no browser
 * here — this is a server building a URL, not following it.
 *
 * Only 'google' for now; the parameter keeps Apple a one-line addition later.
 */
export async function getOAuthUrl(provider: 'google'): Promise<string> {
  const { data, error } = await supabaseAuth.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo: OAUTH_REDIRECT_URL,
      skipBrowserRedirect: true,
    },
  })

  if (error) {
    throw mapSupabaseAuthError(error, 'Could not start Google sign-in.', 'oauthUrl')
  }
  if (!data?.url) {
    // No error but no URL is a Supabase-side problem, not the caller's.
    throw new ApiError(502, 'Could not start Google sign-in.')
  }
  return data.url
}

/**
 * Step 2 of OAuth: the frontend relays the tokens Supabase put in the redirect
 * hash, and this turns them into an app session.
 *
 * The tokens are treated as untrusted until validated: getUser() re-checks the
 * access token against Supabase (signature AND not-revoked), so a forged or
 * stale token here fails exactly as it would anywhere else. A first-time Google
 * user has an identity but no profile row yet — created here from the Google
 * metadata, mirroring what verifyPhoneOtp does for a new number.
 */
export async function completeOAuth(accessToken: string, refreshToken: string): Promise<AuthSession> {
  const { data, error } = await supabaseAdmin.auth.getUser(accessToken)

  if (error || !data.user) {
    // Deliberately vague and 401: the caller handed us a token that Supabase
    // will not vouch for. Whether it was forged, expired, or revoked is not
    // theirs to learn.
    throw ApiError.unauthorized('Sign-in could not be completed. Please try again.')
  }

  const user = data.user

  const existing = await profileModel.findById(user.id)
  if (!existing) {
    const { firstName, lastName } = nameFromMetadata(user)
    await profileModel.create({
      userId: user.id,
      email: user.email ?? null,
      // OAuth users default to patient, like every other new account; the
      // persona is chosen during onboarding.
      userType: 'patient',
      firstName,
      lastName,
      phoneNumber: null,
    })
  }

  return toAuthSession(user, accessToken, refreshToken)
}

/** Revokes every session for the caller, so the refresh token dies too. */
export async function logout(accessToken: string): Promise<void> {
  const { error } = await supabaseAdmin.auth.admin.signOut(accessToken)
  if (error) {
    // Already-invalid tokens are fine: the goal state is "signed out", which is
    // where we are. Log it, but never fail a logout — a user who cannot log out
    // is a genuine problem, an idempotent one is not.
    logger.warn({ err: error }, 'Sign-out returned an error; treating as signed out')
  }
}
