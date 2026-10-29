'use client'

import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import { env } from '@/lib/env'
// Compiled to components by the SVGR rule in next.config.ts — these ARE the
// files in src/icons, not copies of them. google is a raster brand mark, so it
// stays an <Image>.
import PhoneIcon from '@/icons/phone.svg'
import MessageIcon from '@/icons/message.svg'
import AppleIcon from '@/icons/apple.svg'
import googleMark from '@/icons/google.png'

/**
 * The "Continue with …" rows.
 *
 * Each sign-in screen offers the methods it is NOT currently showing a form
 * for, so the caller passes the list explicitly.
 *
 * Google is wired: it navigates to the backend's GET /auth/google, which 302s to
 * Google's consent screen. It is a full-page navigation, not a fetch — the whole
 * document leaves for Google and returns to /auth/callback — so window.location,
 * not the router. Apple is a deliberate future feature and says "coming soon"
 * on click rather than rendering a dead button.
 */

export type Provider = 'phone' | 'email' | 'google' | 'apple'

const GOOGLE_ALT = '' // decorative: the visible label already says "Google"

export function ProviderButtons({ show }: { show: Provider[] }) {
  const router = useRouter()
  const [unavailable, setUnavailable] = useState<string | null>(null)

  const comingSoon = (name: string) => setUnavailable(`${name} sign-in is coming soon.`)

  // A top-level navigation to the backend, which redirects on to Google. The
  // env base already ends in /v1, so this resolves to e.g.
  // http://localhost:5000/v1/auth/google.
  const startGoogle = () => {
    window.location.href = `${env.apiBaseUrl}/auth/google`
  }

  // Icons are aria-hidden: each sits beside a visible label that already says
  // "Continue with Phone", so announcing them only repeats it.
  // Sizes are explicit because SVGR strips the exported dimensions — and they
  // are not all square: apple.svg is a 24x28 viewBox, so forcing size-6 on it
  // would letterbox the mark inside its own box.
  const ICON = 'shrink-0'

  const BUTTONS: Record<Provider, { label: string; icon: React.ReactNode; onClick: () => void }> = {
    phone: {
      label: 'Continue with Phone',
      icon: <PhoneIcon aria-hidden="true" focusable="false" className={`${ICON} size-6 text-foreground-secondary`} />,
      onClick: () => router.push(ROUTES.auth.signinPhone),
    },
    email: {
      label: 'Continue with Email',
      icon: <MessageIcon aria-hidden="true" focusable="false" className={`${ICON} size-6 text-foreground-secondary`} />,
      onClick: () => router.push(ROUTES.auth.signinEmail),
    },
    google: {
      label: 'Continue with Google',
      icon: <Image src={googleMark} alt={GOOGLE_ALT} width={24} height={24} className={`${ICON} size-6`} />,
      onClick: startGoogle,
    },
    apple: {
      label: 'Continue with Apple',
      icon: <AppleIcon aria-hidden="true" focusable="false" className={`${ICON} h-7 w-6 text-foreground`} />,
      onClick: () => comingSoon('Apple'),
    },
  }

  return (
    <div className="flex flex-col gap-md">
      {show.map((key) => {
        const b = BUTTONS[key]
        return (
          <Button key={key} variant="surface" icon={b.icon} onClick={b.onClick}>
            {b.label}
          </Button>
        )
      })}

      {unavailable && (
        <p role="status" className="text-center text-h2 text-foreground-secondary">
          {unavailable}
        </p>
      )}
    </div>
  )
}
