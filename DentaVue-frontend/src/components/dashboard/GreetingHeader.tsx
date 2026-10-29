'use client'

import { useAppSelector } from '@/store/hooks'
import { selectCurrentUser } from '@/features/auth/authSlice'
import BellIcon from '@/icons/bell.svg'

/**
 * "Good morning, {name}" + notification bell.
 *
 * The name is pulled from the signed-in user so the greeting is real rather than
 * hard-coded — falling back to "there" when the profile has no first name yet
 * (onboarding hasn't run) or state was cleared by a refresh. Client component
 * because it reads the auth slice.
 *
 * The greeting is fixed at "Good morning" rather than time-derived: computing it
 * from the clock during render risks a server/client hydration mismatch, and
 * time-of-day greetings belong on the server once one exists.
 */
export function GreetingHeader() {
  const user = useAppSelector(selectCurrentUser)
  const name = user?.firstName?.trim() || 'there'

  return (
    <header className="flex items-start justify-between gap-sm">
      <div className="flex flex-col gap-2xs">
        <span className="text-h1-lg text-foreground">Good morning</span>
        <span className="text-h1 font-medium text-foreground">{name}</span>
      </div>

      <button
        type="button"
        aria-label="Notifications, 1 unread"
        className="relative flex size-9 items-center justify-center rounded-full bg-surface shadow-drop focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <BellIcon aria-hidden="true" className="size-5 text-foreground" />
        <span
          aria-hidden="true"
          className="absolute right-1.5 top-1.5 size-2 rounded-full bg-error ring-2 ring-surface"
        />
      </button>
    </header>
  )
}
