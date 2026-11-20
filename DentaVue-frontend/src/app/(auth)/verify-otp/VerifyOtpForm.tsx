'use client'

import { useEffect, useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { OtpInput } from '@/components/ui/OtpInput'
import { MockOtpNotice } from '@/components/auth/MockOtpNotice'
import {
  getInstantOtp,
  saveInstantOtp,
  useResendPhoneOtpMutation,
  useVerifyPhoneOtpMutation,
} from '@/features/auth/authApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { formatCountdown, useCountdown } from '@/hooks/useCountdown'
import { ROUTES } from '@/constants/routes'

const OTP_LENGTH = 6
const DEFAULT_EXPIRY_SECONDS = 300

/**
 * Screen 4 — verify the SMS / Instant Phone OTP code.
 */
export function VerifyOtpForm({ phoneNumber }: { phoneNumber: string }) {
  const router = useRouter()

  const [verify, { isLoading: isVerifying, error: verifyError }] = useVerifyPhoneOtpMutation()
  const [resend, { isLoading: isResending, error: resendError }] = useResendPhoneOtpMutation()

  const [code, setCode] = useState('')
  const [instantCode, setInstantCode] = useState<string | null>(null)
  const [localError, setLocalError] = useState<string | undefined>()
  const { remaining, isExpired, restart } = useCountdown(DEFAULT_EXPIRY_SECONDS)

  useEffect(() => {
    if (!phoneNumber) return
    setInstantCode(getInstantOtp(phoneNumber))
  }, [phoneNumber])

  const submit = async (value: string) => {
    if (value.length !== OTP_LENGTH) {
      setLocalError(`Enter all ${OTP_LENGTH} digits`)
      return
    }
    setLocalError(undefined)

    try {
      const session = await verify({ phoneNumber, otp: value }).unwrap()
      saveInstantOtp(phoneNumber, undefined)
      // Route new phone accounts without a profile name into onboarding
      if (!session.user.firstName) {
        router.push(ROUTES.onboarding.welcome)
      } else {
        router.push(ROUTES.patient.dashboard)
      }
    } catch {
      // Rendered from verifyError below.
    }
  }

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    void submit(code)
  }

  const handleResend = async () => {
    setCode('')
    setLocalError(undefined)
    try {
      const result = await resend({ phoneNumber }).unwrap()
      if (result.otpCode) {
        setInstantCode(result.otpCode)
      }
      restart(result.expiresInSeconds || DEFAULT_EXPIRY_SECONDS)
    } catch {
      // Rendered from resendError below.
    }
  }

  if (!phoneNumber) {
    return (
      <div className="flex flex-col items-center gap-lg">
        <h1 className="text-h1-xl font-semibold text-foreground">Something went missing</h1>
        <p className="text-center text-h2 text-foreground-secondary">
          We don&apos;t know which number to verify. Please start again.
        </p>
        <Button variant="primary" onClick={() => router.push(ROUTES.auth.signinPhone)}>
          Back to sign in
        </Button>
      </div>
    )
  }

  const apiError = getApiErrorMessage(verifyError ?? resendError)

  return (
    <>
      <header className="flex flex-col items-center">
        <h1 className="text-h1-xl font-semibold text-foreground">Check Your Messages</h1>
        <p className="mt-sm text-center text-h2 text-foreground-secondary">
          We sent a code to <span className="text-foreground">{phoneNumber}</span> check inbox
        </p>
      </header>

      <div className="mt-2xl">
        <MockOtpNotice phoneNumber={phoneNumber} />
        {instantCode && (
          <div
            role="status"
            className="mb-lg flex flex-col items-center gap-xs rounded-3 border border-primary/30 bg-surface p-md text-center shadow-sm"
          >
            <span className="text-nav font-medium text-primary">
              Instant Verification Code
            </span>
            <p className="font-mono text-h1-xl font-bold tracking-widest text-foreground">
              {instantCode}
            </p>
            <button
              type="button"
              onClick={() => {
                setCode(instantCode)
                void submit(instantCode)
              }}
              className="mt-2xs rounded-full bg-primary px-md py-2xs text-nav font-semibold text-surface transition-opacity hover:opacity-90"
            >
              Tap to Auto-Fill & Verify
            </button>
          </div>
        )}
      </div>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
        <OtpInput
          label="Verification code"
          value={code}
          onChange={setCode}
          length={OTP_LENGTH}
          disabled={isVerifying}
          error={localError ?? apiError}
          // Submitting on the last digit is the whole point of an OTP screen —
          // but the Verify button stays, for anyone pasting or correcting.
          onComplete={(value) => void submit(value)}
        />

        <Button type="submit" variant="secondary" disabled={isVerifying || code.length === 0}>
          {isVerifying ? 'Verifying…' : 'Verify'}
        </Button>
      </form>

      <div className="mt-lg flex flex-col items-center gap-xs">
        <p className="text-h2 text-foreground-secondary">
          Didn&apos;t receive code?{' '}
          <button
            type="button"
            onClick={handleResend}
            disabled={isResending || !isExpired}
            className="rounded-1 text-foreground underline underline-offset-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 disabled:no-underline disabled:opacity-50"
          >
            {isResending ? 'Sending…' : 'Resend'}
          </button>
        </p>

        {/* Ticking text is not announced — a live region here would interrupt a
            screen reader every second. The expiry message below is. */}
        <p className="text-h2 text-foreground-secondary" aria-hidden="true">
          {isExpired ? 'Code expired' : `Code Expires in ${formatCountdown(remaining)}`}
        </p>
        <p className="sr-only" role="status">
          {isExpired ? 'Your code has expired. Request a new one.' : ''}
        </p>
      </div>
    </>
  )
}
