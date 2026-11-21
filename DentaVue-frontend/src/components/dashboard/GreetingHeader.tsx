'use client'

import { useState } from 'react'
import { useAppSelector } from '@/store/hooks'
import { selectCurrentUser } from '@/features/auth/authSlice'
import { ReminderModal, useReminders } from '@/components/reminders/ReminderModal'
import BellIcon from '@/icons/bell.svg'
import DentaVueLogo from '@/icons/teeth-ai.svg'

/**
 * DentaVue company logo + brand header + "Hi, {name}" subtitle + live reminder bell.
 */
export function GreetingHeader() {
  const user = useAppSelector(selectCurrentUser)
  const name = user?.firstName?.trim() || 'there'
  const reminders = useReminders()
  const [remindersOpen, setRemindersOpen] = useState(false)

  const activeCount = reminders.filter((r) => !r.done).length

  return (
    <>
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
          onClick={() => setRemindersOpen(true)}
          aria-label={
            activeCount > 0 ? `Check-in reminders (${activeCount} active)` : 'Set a check-in reminder'
          }
          className="relative flex size-9 items-center justify-center rounded-full bg-surface shadow-drop transition-transform active:scale-95 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <BellIcon aria-hidden="true" className="size-5 text-foreground" />
          {activeCount > 0 && (
            <span
              aria-hidden="true"
              className="absolute -right-0.5 -top-0.5 grid size-4 place-items-center rounded-full bg-primary text-[10px] font-bold text-surface ring-2 ring-surface"
            >
              {activeCount}
            </span>
          )}
        </button>
      </header>

      <ReminderModal open={remindersOpen} onClose={() => setRemindersOpen(false)} />
    </>
  )
}
