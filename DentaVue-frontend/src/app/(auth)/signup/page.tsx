'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthTopBar } from '@/components/auth/AuthTopBar'
import { AuthDivider } from '@/components/auth/AuthDivider'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { PasswordField } from '@/components/ui/PasswordField'
import { Checkbox } from '@/components/ui/Checkbox'
import { useSignupMutation } from '@/features/auth/authApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { validateEmail } from '@/lib/validation'
import { getPasswordStrength, getPasswordStrengthLabel } from '@/lib/passwordStrength'
import { ROUTES } from '@/constants/routes'

/**
 * Create Account.
 *
 * The four mockups are one screen in four validation states, so they are driven
 * by state rather than built as four layouts: clean, invalid email, weak
 * password, strong password.
 *
 * Errors appear on submit, and after that update live per keystroke. Validating
 * from the first character shouts "invalid email" at someone who has typed "a";
 * never re-validating leaves the error stale while they fix it. Waiting for the
 * first submit, then tracking, is the middle ground people actually expect.
 *
 * The strength hint is the exception — it appears as you type, because that is
 * the entire point of a strength hint.
 */
export default function SignUpPage() {
  const router = useRouter()
  const [signup, { isLoading, error }] = useSignupMutation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptTerms, setAcceptTerms] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const strength = getPasswordStrength(password)
  const strengthLabel = getPasswordStrengthLabel(strength)

  // Only surfaced once a submit has been attempted — see above.
  const emailError = submitted && validateEmail(email) ? 'Invalid email id' : undefined
  const passwordError = submitted && strength !== 'strong' ? 'Password is not strong enough' : undefined
  const termsError = submitted && !acceptTerms ? 'Please accept the terms to continue' : undefined

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSubmitted(true)

    if (validateEmail(email) || strength !== 'strong' || !acceptTerms) return

    try {
      await signup({ email: email.trim(), password, acceptTerms: true }).unwrap()
      // Into onboarding, which now opens with the welcome splash (step 1); its
      // "Get Started" advances to the persona chooser. Sign-up issues a session
      // (see authApi), so the rest of onboarding — including the profile save —
      // is authenticated.
      router.push(ROUTES.onboarding.welcome)
    } catch {
      // Rendered from `error` below.
    }
  }

  return (
    <>
      <AuthTopBar title="Create Account" fallbackHref={ROUTES.auth.signin} />

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-lg">
        <TextField
          label="Email Address"
          showLabel
          required
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Continue with email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={emailError}
          disabled={isLoading}
        />

        <PasswordField
          label="Password"
          showLabel
          required
          name="password"
          // "new-password" — not "current-password": it tells the browser and
          // password managers to OFFER a generated one rather than autofill an
          // existing credential into a sign-up form.
          autoComplete="new-password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={passwordError}
          disabled={isLoading}
          hint={
            strengthLabel && (
              <p
                // Announced politely so a screen-reader user hears the verdict
                // without being interrupted on every keystroke.
                role="status"
                className={`mt-xs text-h2 ${
                  strength === 'strong' ? 'text-success-text' : 'text-error'
                }`}
              >
                {strengthLabel}
              </p>
            )
          }
        />

        <Checkbox
          name="acceptTerms"
          checked={acceptTerms}
          onChange={(e) => setAcceptTerms(e.target.checked)}
          disabled={isLoading}
          error={termsError}
        >
          <span className="text-body leading-none tracking-tight text-foreground-secondary">
            By creating an account, you agree to DentaVue&apos;s Terms of Service and Privacy Policy.
          </span>
        </Checkbox>

        {error && (
          <p role="alert" className="text-center text-h2 text-error">
            {getApiErrorMessage(error, "Couldn't create your account. Please try again.")}
          </p>
        )}

        {/* h-12 (48px) per the spec — the inputs above are 52px. */}
        <Button type="submit" variant="primary" disabled={isLoading} className="h-12">
          {isLoading ? 'Creating account…' : 'Continue'}
        </Button>
      </form>

      <div className="mt-2xl flex flex-col gap-lg">
        <AuthDivider />
        <ProviderButtons show={['phone', 'google', 'apple']} />

        <p className="text-center text-h1 leading-none tracking-tight text-foreground-secondary">
          Already have an account?{' '}
          <Link
            href={ROUTES.auth.signin}
            className="rounded-1 font-medium text-foreground underline underline-offset-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Log in
          </Link>
        </p>
      </div>
    </>
  )
}
