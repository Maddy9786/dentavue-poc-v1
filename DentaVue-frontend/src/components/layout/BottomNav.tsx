'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ROUTES } from '@/constants/routes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useLogoutMutation } from '@/features/auth/authApi'
import MenuIcon from '@/icons/Menu.svg'
import ProfileIcon from '@/icons/profile.svg'
import ScanIcon from '@/icons/scan.svg'
import InsightIcon from '@/icons/insight.svg'
import UserIcon from '@/icons/user.svg'

/**
 * Fixed bottom tab bar for the patient app.
 *
 * Five slots: Home (a link to the current page), Profile and Insights (features
 * not built — each opens a "coming soon" popup), Scan (the raised centre tile —
 * opens the guided-scan flow, which then leads to the camera), and Account
 * (opens sign-in / sign-up when signed out, or sign-out when signed in).
 *
 * Home's icon uses currentColor so it can tint primary when active; the other
 * icons are colour-locked to the foreground by the SVGR mapping, which matches
 * the design's dark glyphs. Every item has an accessible name (icons are
 * aria-hidden); the active tab carries aria-current.
 */
type PopupKey = 'profile' | 'insight' | 'account'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const [logout] = useLogoutMutation()
  const [popup, setPopup] = useState<PopupKey | null>(null)

  const close = () => setPopup(null)
  const homeActive = pathname === ROUTES.patient.dashboard

  const goTo = (href: string) => {
    close()
    router.push(href)
  }

  const handleSignOut = async () => {
    try {
      await logout().unwrap()
    } catch {
      // The logout mutation clears local session state either way (see authApi);
      // a failed server revoke must not leave the user stuck signed-in.
    }
    close()
  }

  // 44px touch targets for the side items; the icon centres within.
  const sideItem =
    'flex size-11 items-center justify-center rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2'

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface"
      >
        <ul className="mx-auto flex h-[84px] app-column items-center justify-around px-lg">
          <li className="flex items-center">
            {/* Menu.svg is the complete active-home mark: a faint highlight box,
                the filled house, and its own primary base bar — all self-coloured
                in #3B9DF0, so it needs no tint or separate indicator. */}
            <Link
              href={ROUTES.patient.dashboard}
              aria-label="Home"
              aria-current={homeActive ? 'page' : undefined}
              className="flex items-center justify-center rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <MenuIcon aria-hidden="true" className="size-12" />
            </Link>
          </li>

          <li>
            <button type="button" aria-label="Profile" className={sideItem} onClick={() => setPopup('profile')}>
              <ProfileIcon aria-hidden="true" className="size-11" />
            </button>
          </li>

          <li>
            <button
              type="button"
              aria-label="Scan"
              onClick={() => goTo(ROUTES.patient.guidedScan)}
              className="flex items-center justify-center rounded-3 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ScanIcon aria-hidden="true" className="size-14" />
            </button>
          </li>

          <li>
            <button type="button" aria-label="Insights" className={sideItem} onClick={() => setPopup('insight')}>
              <InsightIcon aria-hidden="true" className="size-11" />
            </button>
          </li>

          <li>
            <button
              type="button"
              aria-label={isAuthenticated ? 'Account and sign out' : 'Sign in or sign up'}
              className={sideItem}
              onClick={() => setPopup('account')}
            >
              <UserIcon aria-hidden="true" className="size-11" />
            </button>
          </li>
        </ul>
      </nav>

      <Modal open={popup === 'profile'} onClose={close} title="Profile">
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">
            Your profile is coming soon — you&apos;ll manage your details and preferences here.
          </p>
          {/* Primary blue + white per the client's combination (below AA on the
              fill; kept per client instruction, pending confirmation). */}
          <Button variant="primary" className="text-surface" onClick={close}>
            Got it
          </Button>
        </div>
      </Modal>

      <Modal open={popup === 'insight'} onClose={close} title="Insights">
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">
            Insights are a work in progress — deeper analysis of your oral-health trends will appear
            here soon.
          </p>
          {/* Primary blue + white per the client's combination (below AA on the
              fill; kept per client instruction, pending confirmation). */}
          <Button variant="primary" className="text-surface" onClick={close}>
            Got it
          </Button>
        </div>
      </Modal>

      <Modal open={popup === 'account'} onClose={close} title="Account">
        {isAuthenticated ? (
          <div className="flex flex-col gap-lg">
            <p className="text-h2 text-foreground-secondary">You&apos;re signed in.</p>
            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="text-h2 text-foreground-secondary">
              Sign in or create an account to save your progress.
            </p>
            <Button variant="secondary" onClick={() => goTo(ROUTES.auth.signin)}>
              Sign in
            </Button>
            <Button variant="surface" onClick={() => goTo(ROUTES.auth.signup)}>
              Create account
            </Button>
          </div>
        )}
      </Modal>
    </>
  )
}
