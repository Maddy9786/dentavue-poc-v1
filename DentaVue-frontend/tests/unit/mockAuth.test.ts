// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { issueMockOtp, peekMockOtp, verifyMockOtp } from '@/features/auth/mockAuth'

/**
 * The mock OTP flow is only reachable through a browser (sessionStorage, a real
 * click, a real navigation), so it cannot be checked with curl. These tests
 * exercise the same contract the screens depend on.
 *
 * They deliberately assert the FAILURE cases too: a mock that accepts anything
 * would let the sign-in screens pass review while proving nothing about whether
 * the wrong-code and expiry paths render.
 */

const PHONE = '+919876543210'

beforeEach(() => {
  window.sessionStorage.clear()
  vi.useRealTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('issueMockOtp', () => {
  it('returns the same shape as POST /auth/signin-phone', () => {
    const result = issueMockOtp(PHONE)
    expect(result).toEqual({ phoneNumber: PHONE, otpSent: true, expiresInSeconds: 300 })
  })

  it('stores a 6-digit code that the banner can read back', () => {
    issueMockOtp(PHONE)
    expect(peekMockOtp(PHONE)).toMatch(/^\d{6}$/)
  })

  it('issues a fresh code on resend, replacing the previous one', () => {
    issueMockOtp(PHONE)
    const first = peekMockOtp(PHONE)
    // Force a different code rather than relying on chance.
    vi.spyOn(Math, 'random').mockReturnValue(0.123456)
    issueMockOtp(PHONE)
    const second = peekMockOtp(PHONE)

    expect(second).toMatch(/^\d{6}$/)
    expect(second).not.toBe(first)
    vi.restoreAllMocks()
  })

  it('keeps codes separate per phone number', () => {
    issueMockOtp(PHONE)
    issueMockOtp('+911111111111')
    expect(peekMockOtp(PHONE)).not.toBeNull()
    expect(peekMockOtp('+911111111111')).not.toBeNull()
  })
})

describe('peekMockOtp', () => {
  it('is null when no code was issued', () => {
    expect(peekMockOtp(PHONE)).toBeNull()
  })

  it('is null once the code has expired', () => {
    vi.useFakeTimers()
    issueMockOtp(PHONE)
    expect(peekMockOtp(PHONE)).not.toBeNull()

    vi.advanceTimersByTime(301_000) // just past the 300s window
    expect(peekMockOtp(PHONE)).toBeNull()
  })
})

describe('verifyMockOtp', () => {
  it('accepts the issued code and returns a session', () => {
    issueMockOtp(PHONE)
    const code = peekMockOtp(PHONE)!

    const result = verifyMockOtp(PHONE, code)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.session.user.userType).toBe('patient')
      expect(result.session.accessToken).toContain('not-a-real-session')
      // UUID-shaped, matching the real API's IDs (see types/api.ts) — a mock
      // whose IDs are a different shape would hide format bugs until the real
      // endpoint takes over. Pinned so the shape can't quietly drift back.
      expect(result.session.user.userId).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
      )
    }
  })

  it('gives the same number a stable id across sign-ins', () => {
    issueMockOtp(PHONE)
    const first = verifyMockOtp(PHONE, peekMockOtp(PHONE)!)
    issueMockOtp(PHONE)
    const second = verifyMockOtp(PHONE, peekMockOtp(PHONE)!)

    expect(first.ok && second.ok).toBe(true)
    if (first.ok && second.ok) {
      expect(first.session.user.userId).toBe(second.session.user.userId)
    }
  })

  it('rejects a wrong code', () => {
    issueMockOtp(PHONE)
    const code = peekMockOtp(PHONE)!
    const wrong = code === '000000' ? '111111' : '000000'

    const result = verifyMockOtp(PHONE, wrong)
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.message).toBe('That code is invalid or has expired')
  })

  it('rejects when nothing was ever issued', () => {
    expect(verifyMockOtp(PHONE, '123456').ok).toBe(false)
  })

  it('rejects an expired code even when the digits are right', () => {
    vi.useFakeTimers()
    issueMockOtp(PHONE)
    const code = peekMockOtp(PHONE)!

    vi.advanceTimersByTime(301_000)
    expect(verifyMockOtp(PHONE, code).ok).toBe(false)
  })

  it('burns the code — it cannot be replayed', () => {
    issueMockOtp(PHONE)
    const code = peekMockOtp(PHONE)!

    expect(verifyMockOtp(PHONE, code).ok).toBe(true)
    expect(verifyMockOtp(PHONE, code).ok).toBe(false)
    expect(peekMockOtp(PHONE)).toBeNull()
  })

  it("rejects another number's code", () => {
    issueMockOtp(PHONE)
    const code = peekMockOtp(PHONE)!
    expect(verifyMockOtp('+911111111111', code).ok).toBe(false)
  })
})
