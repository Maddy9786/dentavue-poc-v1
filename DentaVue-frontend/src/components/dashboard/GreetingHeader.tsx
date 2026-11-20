'use client'

import { useAppSelector } from '@/store/hooks'
import { selectCurrentUser } from '@/features/auth/authSlice'
import BellIcon from '@/icons/bell.svg'
import DentaVueLogo from '@/icons/teeth-ai.svg'

/**
 * DentaVue company logo + brand header + "Hi, {name}" subtitle + notification bell.
 *
 * Uses the official DentaVue tooth-AI mark (`teeth-ai.svg`) in a circular surface
 * badge alongside the "DentaVue" title and user greeting.
 */
export function GreetingHeader() {
  const user = useAppSelector(selectCurrentUser)
  const name = user?.firstName?.trim() || 'there'

  return (
    <header className="flex items-center justify-between gap-sm">
      <div className="flex items-center gap-sm">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-full border-2 border-secondary/35 bg-surface shadow-drop ring-2 ring-surface">
          <DentaVueLogo aria-hidden="true" focusable="false" className="size-7" />
        </div>
        <div className="flex flex-col">
          <span className="text-h1 leading-tight font-bold tracking-tight text-foreground">
            DentaVue
          </span>
          <span className="text-body font-medium text-foreground-secondary">Hi, {name}</span>
        </div>
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
