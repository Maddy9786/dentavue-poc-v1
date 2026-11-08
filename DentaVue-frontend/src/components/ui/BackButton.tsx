'use client'

import { useRouter } from 'next/navigation'
import BackFilledIcon from '@/icons/back-filled.svg'

/**
 * Back control. `back-filled.svg` is a self-contained chip (its own rounded box +
 * arrow), so it renders directly — the button is just the icon plus a focus ring.
 * Prefers real history (router.back) so it returns to wherever the user came
 * from, and falls back to `fallbackHref` when the screen was opened directly — the
 * arrow is never a dead control.
 *
 * The label is a real accessible name; the icon itself is decorative.
 */
export function BackButton({
  fallbackHref,
  label = 'Go back',
}: {
  fallbackHref: string
  label?: string
}) {
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label}
      className="rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
    >
      <BackFilledIcon aria-hidden="true" focusable="false" className="size-9" />
    </button>
  )
}
