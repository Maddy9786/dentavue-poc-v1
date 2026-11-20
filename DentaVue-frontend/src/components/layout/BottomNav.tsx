'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState } from 'react'
import { ROUTES } from '@/constants/routes'
import { Modal } from '@/components/ui/Modal'
import { Button } from '@/components/ui/Button'
import { useAppSelector } from '@/store/hooks'
import { selectCurrentUser, selectIsAuthenticated } from '@/features/auth/authSlice'
import { useLogoutMutation } from '@/features/auth/authApi'
import MenuIcon from '@/icons/Menu.svg'
import ProfileIcon from '@/icons/profile.svg'
import ScanIcon from '@/icons/scan.svg'
import InsightIcon from '@/icons/insight.svg'
import UserIcon from '@/icons/user.svg'

/**
 * Fixed bottom tab bar for the patient app — all 5 tabs are live:
 *   1. Home      → `/` (Dashboard)
 *   2. Compare   → `/compare` (Scan-over-scan progress comparison)
 *   3. Scan      → `/guided-scan` (4-angle Guided Camera Scan)
 *   4. Care Guide → `/ai-insight` (Personal Care Guide & daily routine)
 *   5. Account   → Account & Profile modal (User details, Edit Profile, Latest Results, Sign Out)
 */
type PopupKey = 'account' | 'signin-required'

export function BottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const currentUser = useAppSelector(selectCurrentUser)
  const [logout] = useLogoutMutation()
  const [popup, setPopup] = useState<PopupKey | null>(null)

  const close = () => setPopup(null)
  const homeActive = pathname === ROUTES.patient.dashboard
  const compareActive = pathname === ROUTES.patient.compare
  const insightActive = pathname === ROUTES.patient.aiInsight

  const goTo = (href: string) => {
    close()
    router.push(href)
  }

  const goProtected = (href: string) => {
    if (!isAuthenticated) {
      setPopup('signin-required')
      return
    }
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

  const sideItem =
    'flex flex-col items-center justify-center gap-0.5 rounded-2 px-xs py-1 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2'

  const displayName =
    currentUser?.firstName || currentUser?.lastName
      ? `${currentUser.firstName} ${currentUser.lastName}`.trim()
      : 'DentaVue Member'

  const displayContact = currentUser?.email
    ? currentUser.email.endsWith('@phone.dentavue.app')
      ? `+${currentUser.email.replace('phone.', '').replace('@phone.dentavue.app', '')}`
      : currentUser.email
    : 'Signed-in account'

  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-10 border-t border-border bg-surface/95 backdrop-blur-md"
      >
        <ul className="mx-auto flex h-[84px] app-column items-center justify-around px-md">
          {/* Tab 1: Home */}
          <li className="flex items-center">
            <Link
              href={ROUTES.patient.dashboard}
              aria-label="Home"
              aria-current={homeActive ? 'page' : undefined}
              className="flex flex-col items-center justify-center rounded-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <MenuIcon aria-hidden="true" className="size-11" />
              <span className="text-[11px] font-semibold text-primary">Home</span>
            </Link>
          </li>

          {/* Tab 2: Compare Progress */}
          <li>
            <button
              type="button"
              aria-label="Compare progress"
              aria-current={compareActive ? 'page' : undefined}
              className={sideItem}
              onClick={() => goProtected(ROUTES.patient.compare)}
            >
              <ProfileIcon aria-hidden="true" className="size-9" />
              <span className="text-[11px] font-medium text-foreground-secondary">Compare</span>
            </button>
          </li>

          {/* Tab 3: Guided Camera Scan */}
          <li>
            <button
              type="button"
              aria-label="Scan now"
              onClick={() => goTo(ROUTES.patient.guidedScan)}
              className="flex flex-col items-center justify-center rounded-3 transition-transform active:scale-95 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <ScanIcon aria-hidden="true" className="size-14" />
            </button>
          </li>

          {/* Tab 4: Personal Care Guide */}
          <li>
            <button
              type="button"
              aria-label="Personal care guide"
              aria-current={insightActive ? 'page' : undefined}
              className={sideItem}
              onClick={() => goProtected(ROUTES.patient.aiInsight)}
            >
              <InsightIcon aria-hidden="true" className="size-9" />
              <span className="text-[11px] font-medium text-foreground-secondary">Care Guide</span>
            </button>
          </li>

          {/* Tab 5: Account & Profile */}
          <li>
            <button
              type="button"
              aria-label={isAuthenticated ? 'Account and profile' : 'Sign in or sign up'}
              className={sideItem}
              onClick={() => setPopup('account')}
            >
              <UserIcon aria-hidden="true" className="size-9" />
              <span className="text-[11px] font-medium text-foreground-secondary">Account</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Sign-in required prompt when tapping Compare or Care Guide while signed out */}
      <Modal open={popup === 'signin-required'} onClose={close} title="Sign in to view">
        <div className="flex flex-col gap-md">
          <p className="text-h2 text-foreground-secondary">
            Sign in with your phone number or email to view your scan comparisons and personal care guide.
          </p>
          <Button variant="primary" className="text-surface" onClick={() => goTo(ROUTES.auth.signin)}>
            Sign in
          </Button>
          <Button variant="surface" onClick={() => goTo(ROUTES.auth.signup)}>
            Create account
          </Button>
        </div>
      </Modal>

      {/* Rich Account & Profile drawer */}
      <Modal open={popup === 'account'} onClose={close} title="Your Account">
        {isAuthenticated ? (
          <div className="flex flex-col gap-md">
            <div className="flex items-center gap-sm rounded-3 border border-border bg-background p-md">
              <div className="grid size-11 shrink-0 place-items-center rounded-full bg-primary text-h1 font-bold text-surface">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-h2 font-semibold text-foreground">{displayName}</span>
                <span className="truncate text-nav text-foreground-secondary">{displayContact}</span>
              </div>
            </div>

            <Button
              variant="primary"
              className="text-surface"
              onClick={() => goTo(ROUTES.onboarding.profile)}
            >
              Edit Health Profile & Goals
            </Button>

            <Button variant="surface" onClick={() => goTo(ROUTES.patient.scanResults)}>
              View Latest Scan Report
            </Button>

            <Button variant="secondary" onClick={handleSignOut}>
              Sign out
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-md">
            <p className="text-h2 text-foreground-secondary">
              Sign in with your phone number or email to save your mouth checks and track progress over time.
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
