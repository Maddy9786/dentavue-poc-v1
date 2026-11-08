import type { AuthUser } from './authSlice'
import type { UserId } from '@/types/api'

/**
 * ⚠ MOCK PHONE OTP — DEVELOPMENT ONLY. NOT A SECURITY BOUNDARY.
 *
 * Stands in for Supabase phone OTP. The code is generated in the browser, shown
 * on screen, and checked in the browser, so it authenticates precisely nobody:
 * anyone can read the code they were just given and "sign in" as any number.
 * The session it returns is fabricated — those tokens are not real and no API
 * will accept them.
 *
 * WHY IT IS STILL HERE, AND FOR HOW LONG
 * Not because Supabase is missing — it is not, and email/password sign-in runs
 * against the real thing with this flag on (see SCOPE below). SMS delivery is a
 * paid service and has deliberately not been bought yet, so this stays until
 * that decision is revisited. Treat it as an indefinite state, not a stub that
 * disappears next week.
 *
 * SCOPE — narrower than the file name suggests
 * Only the three phone endpoints are mocked: signin-phone, resend-phone-otp,
 * verify-phone-otp. /auth/signup and /auth/signin have no mock branch and go to
 * the API regardless of this flag. So "mock is on" does NOT mean "auth is fake"
 * — it means the phone door is fake and the email door is real. The flag is
 * named NEXT_PUBLIC_MOCK_PHONE_OTP rather than AUTH_MOCK for exactly that
 * reason: the broader name invites someone to assume email sign-in is a stub
 * too and to skip testing it.
 *
 * WHAT THIS COSTS, AND IT IS NOT ZERO
 * With the flag on, ANY phone number reaches /dashboard with a fabricated
 * session. That is fine locally and is an authentication bypass anywhere else.
 * Because /dashboard is not route-protected yet the practical damage is small,
 * but it will not stay small — the moment real data lands behind it this flag
 * becomes the way in. It must not survive to a deployed build.
 *
 * HOW IT GOES AWAY
 * The real and mock paths meet at the RTK Query endpoints in authApi.ts, so no
 * screen knows which one is live. Once SMS is configured: unset the flag,
 * delete this file, MockOtpNotice.tsx and its test, and drop the three
 * `if (isPhoneOtpMocked())` branches. Nothing else changes — the request and
 * response shapes here are exactly what the API returns.
 *
 * WHY IT CANNOT LEAK SILENTLY
 * NEXT_PUBLIC_* is substituted at BUILD time, so isPhoneOtpMocked() compiles to
 * a literal. Verified in a no-flag production build: it minifies to
 * `function n(){return!1}` — a constant false. The mock branches are therefore
 * unreachable without rebuilding with the flag set; there is no env var to flip
 * and nothing to toggle from devtools.
 *
 * To be precise about what that does NOT mean: this module still ships in the
 * bundle. The guard is a function call rather than an inline literal, so the
 * minifier keeps the code even though nothing can reach it. It is inert dead
 * weight, not an exposure — but it is there until this file is deleted.
 *
 * Defence in depth: the flag is absent from .env.example, so nothing inherits it
 * by copying; and whenever the mock IS live the OTP screen shows an unmissable
 * banner saying the sign-in is fake.
 */

const STORAGE_PREFIX = 'dentavue.mockOtp.'
const OTP_EXPIRY_SECONDS = 300

interface StoredOtp {
  code: string
  expiresAt: number
}

/**
 * NEXT_PUBLIC_* is inlined at build time, so this is decided when the bundle is
 * built, not at runtime — a production build without the flag simply has no mock
 * path in it. Referenced by full literal name; destructuring process.env breaks
 * Next's substitution.
 */
export function isPhoneOtpMocked(): boolean {
  return process.env.NEXT_PUBLIC_MOCK_PHONE_OTP === 'true'
}

function storageKey(phoneNumber: string): string {
  return `${STORAGE_PREFIX}${phoneNumber}`
}

/**
 * Minimal subscription so the on-screen banner can track the stored code with
 * useSyncExternalStore — React's contract for reading external mutable state,
 * which handles SSR and avoids reading storage during render.
 */
const listeners = new Set<() => void>()

export function subscribeMockOtp(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function emitChange(): void {
  for (const listener of listeners) listener()
}

/**
 * sessionStorage, not module state: the OTP screen is a different route, and a
 * refresh there would otherwise lose the code and strand the user. Scoped to the
 * tab and cleared when it closes — right for something disposable.
 */
function readStored(phoneNumber: string): StoredOtp | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.sessionStorage.getItem(storageKey(phoneNumber))
    if (!raw) return null
    return JSON.parse(raw) as StoredOtp
  } catch {
    // Private-mode Safari throws on sessionStorage; a broken mock must not be a
    // crash.
    return null
  }
}

/** Math.random is fine here: the code is printed on screen, so unguessability is not a property this has. */
function generateCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000))
}

export interface MockOtpIssued {
  phoneNumber: string
  otpSent: true
  expiresInSeconds: number
}

/** Mirrors POST /auth/signin-phone. */
export function issueMockOtp(phoneNumber: string): MockOtpIssued {
  const record: StoredOtp = {
    code: generateCode(),
    expiresAt: Date.now() + OTP_EXPIRY_SECONDS * 1000,
  }

  try {
    window.sessionStorage.setItem(storageKey(phoneNumber), JSON.stringify(record))
  } catch {
    // Ignore — peekMockOtp will return null and the screen says so.
  }

  emitChange()
  return { phoneNumber, otpSent: true, expiresInSeconds: OTP_EXPIRY_SECONDS }
}

/**
 * The current code, for the on-screen dev banner. Null once expired.
 *
 * Returns a primitive so it is safe as a useSyncExternalStore snapshot: React
 * compares snapshots by identity and would loop forever on a fresh object.
 */
export function peekMockOtp(phoneNumber: string): string | null {
  const stored = readStored(phoneNumber)
  if (!stored) return null
  if (Date.now() > stored.expiresAt) return null
  return stored.code
}

/** Server snapshot — there is no sessionStorage during SSR. */
export function peekMockOtpOnServer(): null {
  return null
}

/**
 * A stable, obviously-fake UUID for a number.
 *
 * Stable rather than random so the same number is the same "user" across
 * sign-ins — a fresh id each time would make the mock look like a bug the first
 * time anything caches per-user state.
 */
function makeMockUserId(phoneNumber: string): UserId {
  const digits = phoneNumber.replace(/\D/g, '').slice(-12).padStart(12, '0')
  return `00000000-0000-4000-8000-${digits}` as UserId
}

export type MockVerifyResult =
  | { ok: true; session: { user: AuthUser; accessToken: string; refreshToken: string } }
  | { ok: false; message: string }

/**
 * Mirrors POST /auth/verify-phone-otp, including its failure messages, so the
 * screens render identically once the real endpoint takes over.
 */
export function verifyMockOtp(phoneNumber: string, otp: string): MockVerifyResult {
  const stored = readStored(phoneNumber)

  if (!stored || Date.now() > stored.expiresAt) {
    return { ok: false, message: 'That code is invalid or has expired' }
  }
  if (stored.code !== otp) {
    return { ok: false, message: 'That code is invalid or has expired' }
  }

  window.sessionStorage.removeItem(storageKey(phoneNumber))
  emitChange()

  // Shaped like the real session, and deliberately marked so it is obvious in
  // devtools that these tokens are fabricated.
  return {
    ok: true,
    session: {
      user: {
        // UUID-shaped because real IDs are uuids (see types/api.ts) — a mock
        // whose IDs are a different shape hides format bugs until the real API
        // takes over. The all-zero prefix is not a valid v4 and cannot collide
        // with anything Supabase issues, so it stays obviously fake.
        userId: makeMockUserId(phoneNumber),
        email: '',
        userType: 'patient',
        firstName: '',
        lastName: '',
        emailVerified: false,
      },
      accessToken: 'mock-access-token.not-a-real-session',
      refreshToken: 'mock-refresh-token.not-a-real-session',
    },
  }
}
