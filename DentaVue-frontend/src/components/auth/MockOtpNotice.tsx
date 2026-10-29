'use client'

import { useCallback, useSyncExternalStore } from 'react'
import {
  isPhoneOtpMocked,
  peekMockOtp,
  peekMockOtpOnServer,
  subscribeMockOtp,
} from '@/features/auth/mockAuth'

/**
 * Shows the generated code while mock auth is on — see mockAuth.ts.
 *
 * Renders nothing unless NEXT_PUBLIC_MOCK_PHONE_OTP is "true". The flag is inlined at
 * build time, so in a build without it the guard is a constant false and this
 * can never render — though the component itself still ships. See mockAuth.ts.
 *
 * The wording is blunt on purpose. This banner is the only thing standing
 * between a demo stub and someone believing sign-in works, so it says the
 * sign-in is fake rather than quietly printing a number.
 *
 * useSyncExternalStore, not useState + useEffect: sessionStorage is external
 * mutable state, and this is React's contract for reading it. It supplies a
 * server snapshot (null — there is no sessionStorage during SSR) so hydration
 * matches, and re-reads when a resend issues a new code, with no setState in an
 * effect.
 */
export function MockOtpNotice({ phoneNumber }: { phoneNumber: string }) {
  const getSnapshot = useCallback(() => peekMockOtp(phoneNumber), [phoneNumber])
  const code = useSyncExternalStore(subscribeMockOtp, getSnapshot, peekMockOtpOnServer)

  if (!isPhoneOtpMocked()) return null

  return (
    <div
      role="status"
      className="mb-lg rounded-3 border-2 border-dashed border-error bg-surface p-md text-center"
    >
      <p className="text-h2 font-semibold text-error">Mock sign-in — no SMS was sent</p>

      {code ? (
        <>
          <p className="mt-xs text-h2 text-foreground-secondary">Enter this code:</p>
          {/* Monospace + wide tracking so the digits are easy to read off. */}
          <p className="mt-xs font-mono text-h1-xl font-semibold tracking-widest text-foreground">
            {code}
          </p>
        </>
      ) : (
        <p className="mt-xs text-h2 text-foreground-secondary">
          No code yet — it may have expired. Use Resend.
        </p>
      )}

      <p className="mt-sm text-nav text-foreground-secondary">
        The code is generated and checked in your browser, so it proves nothing. Real sign-in needs
        Supabase attached and an SMS provider configured.
      </p>
    </div>
  )
}
