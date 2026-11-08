'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { AuthFooter } from '@/components/auth/AuthFooter'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useSigninPhoneMutation } from '@/features/auth/authApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { toE164, validatePhone } from '@/lib/validation'
import { ROUTES } from '@/constants/routes'

/**
 * Screen 3 — phone number.
 *
 * The country code is a real <select>, not the static "+911" label in the
 * mockup. A hardcoded code would lock the product to one country, and the
 * region is still unconfirmed — the API spec's examples are US-format while
 * Razorpay/MSG91 imply India-first. A native select also gets keyboard and
 * screen-reader behaviour for free. Defaulted to +91 to match the mockup.
 *
 * On success we route to the OTP screen carrying the number in the query
 * string, so that screen can be linked to, refreshed, and still show which
 * number the code went to.
 */

const COUNTRY_CODES = [
  { code: '+91', label: 'India +91' },
  { code: '+1', label: 'United States +1' },
  { code: '+44', label: 'United Kingdom +44' },
  { code: '+61', label: 'Australia +61' },
  { code: '+971', label: 'United Arab Emirates +971' },
]

export default function SignInPhonePage() {
  const router = useRouter()
  const [signinPhone, { isLoading, error }] = useSigninPhoneMutation()

  const [countryCode, setCountryCode] = useState('+91')
  const [phone, setPhone] = useState('')
  const [phoneError, setPhoneError] = useState<string | undefined>()

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const invalid = validatePhone(phone)
    setPhoneError(invalid)
    if (invalid) return

    const phoneNumber = toE164(countryCode, phone)

    try {
      await signinPhone({ phoneNumber }).unwrap()
      router.push(`${ROUTES.auth.verifyOtp}?phone=${encodeURIComponent(phoneNumber)}`)
    } catch {
      // Rendered from `error` below.
    }
  }

  return (
    <>
      <AuthHeader title="Sign in" subtitle="Start your oral health journey" />

      <form onSubmit={handleSubmit} noValidate className="mt-2xl flex flex-col gap-md">
        <TextField
          label="Phone number"
          type="tel"
          name="phone"
          autoComplete="tel-national"
          inputMode="tel"
          placeholder="123-123-1234"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          error={phoneError}
          disabled={isLoading}
          startSlot={
            <>
              <label htmlFor="country-code" className="sr-only">
                Country code
              </label>
              <select
                id="country-code"
                name="countryCode"
                value={countryCode}
                onChange={(e) => setCountryCode(e.target.value)}
                disabled={isLoading}
                className="h-13 shrink-0 rounded-3 bg-surface px-md text-h1 text-foreground shadow-drop outline-none focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                {COUNTRY_CODES.map((c) => (
                  // The option label is spelled out for screen readers; the
                  // closed select shows just the dial code, as designed.
                  <option key={c.code} value={c.code} aria-label={c.label}>
                    {c.code}
                  </option>
                ))}
              </select>
            </>
          }
        />

        {error && (
          <p role="alert" className="text-center text-h2 text-error">
            {getApiErrorMessage(error, "Couldn't send the code. Please try again.")}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Sending code…' : 'Continue'}
        </Button>
      </form>

      <div className="mt-md flex flex-col gap-lg">
        <ProviderButtons show={['email', 'google', 'apple']} />
        <AuthFooter />
      </div>
    </>
  )
}
