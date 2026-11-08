import type { Metadata } from 'next'
import { AuthHeader } from '@/components/auth/AuthHeader'
import { AuthFooter } from '@/components/auth/AuthFooter'
import { ProviderButtons } from '@/components/auth/ProviderButtons'

export const metadata: Metadata = {
  title: 'Sign in',
}

/**
 * Screen 1 — method chooser.
 *
 * A server component: it has no state of its own, only the interactive
 * ProviderButtons island below it. Keeping the shell on the server means the
 * logo and copy render without waiting on JS.
 */
export default function SignInPage() {
  return (
    <>
      <AuthHeader title="Sign in" subtitle="Start your oral health journey" />

      <div className="mt-3xl flex flex-col gap-lg">
        <ProviderButtons show={['phone', 'email', 'google', 'apple']} />
        <AuthFooter />
      </div>
    </>
  )
}
