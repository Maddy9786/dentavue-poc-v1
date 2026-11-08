'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { AuthFooter } from '@/components/auth/AuthFooter'
import { ProviderButtons } from '@/components/auth/ProviderButtons'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { useSigninMutation } from '@/features/auth/authApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { validateEmail, validatePassword } from '@/lib/validation'
import { ROUTES } from '@/constants/routes'

/**
 * Screen 2 — email + password.
 *
 * A real <form>, not a div with a click handler: that is what gives Enter-to-
 * submit, browser password-manager save/fill, and the mobile keyboard's "Go"
 * key — all for free, and all missing if you hang onClick off a button.
 *
 * Validation runs on submit rather than on every keystroke, so the field does
 * not shout "invalid email" at someone who has typed two characters.
 */
export default function SignInEmailPage() {
  const router = useRouter()
  const [signin, { isLoading, error }] = useSigninMutation()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const next = {
      email: validateEmail(email),
      password: validatePassword(password),
    }
    setFieldErrors(next)
    if (next.email || next.password) return

    try {
      await signin({ email: email.trim(), password }).unwrap()
      router.push(ROUTES.patient.dashboard)
    } catch {
      // Rendered from `error` below; unwrap() rejects and would otherwise
      // surface as an unhandled rejection.
    }
  }

  return (
    <>
      <AuthHeader title="Sign in" subtitle="Start your oral health journey" />

      <form onSubmit={handleSubmit} noValidate className="mt-2xl flex flex-col gap-md">
        <TextField
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="Email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={fieldErrors.email}
          disabled={isLoading}
        />

        <TextField
          label="Password"
          type="password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={fieldErrors.password}
          disabled={isLoading}
        />

        {/* Server-side failures (wrong password, server down) — distinct from
            the per-field messages above. role="alert" so it is announced. */}
        {error && (
          <p role="alert" className="text-center text-h2 text-error">
            {getApiErrorMessage(error, 'Could not sign you in. Check your details and try again.')}
          </p>
        )}

        <Button type="submit" variant="primary" disabled={isLoading}>
          {isLoading ? 'Signing in…' : 'Continue'}
        </Button>
      </form>

      <div className="mt-md flex flex-col gap-lg">
        <p className="text-center text-h2">
          <Link
            href={ROUTES.auth.forgotPassword}
            className="rounded-1 text-foreground-secondary underline underline-offset-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Forgot your password?
          </Link>
        </p>

        <ProviderButtons show={['phone', 'google', 'apple']} />
        <AuthFooter />
      </div>
    </>
  )
}
