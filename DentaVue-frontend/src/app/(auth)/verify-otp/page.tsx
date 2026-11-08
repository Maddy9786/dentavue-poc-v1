import type { Metadata } from 'next'
import { VerifyOtpForm } from './VerifyOtpForm'

export const metadata: Metadata = {
  title: 'Verify your number',
}

/**
 * Screen 4 shell.
 *
 * Reads `?phone=` on the server and hands it down as a prop, rather than the
 * form reaching for useSearchParams. That hook would force the form behind a
 * Suspense boundary and ship the whole screen as a loading state — the user
 * sees "Loading…" before the heading appears, on the one screen where they are
 * already waiting for an SMS.
 *
 * The trade is that this route renders dynamically instead of statically, which
 * is correct: its content genuinely depends on the query string.
 */
export default async function VerifyOtpPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string }>
}) {
  const { phone } = await searchParams
  return <VerifyOtpForm phoneNumber={phone ?? ''} />
}
