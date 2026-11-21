'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { ReminderModal, useReminders } from '@/components/reminders/ReminderModal'
import { formatReminderDate } from '@/features/reminders/remindersStore'

/**
 * Primary CTA ("Set a check-in reminder" / "Remind me") wired to the working
 * ReminderModal (presets, custom date, .ics calendar export, browser notification).
 */
export function RescanReminderButton({
  label,
  variant = 'primary',
  className = 'text-surface',
  note,
}: {
  label: string
  variant?: 'primary' | 'secondary' | 'surface'
  className?: string
  note?: string
}) {
  const [open, setOpen] = useState(false)
  const reminders = useReminders()
  const activeReminder = reminders.find((r) => !r.done)

  return (
    <>
      <Button variant={variant} className={className} onClick={() => setOpen(true)}>
        {activeReminder ? `✓ Reminder: ${formatReminderDate(activeReminder.dueAt)}` : label}
      </Button>

      <ReminderModal
        open={open}
        onClose={() => setOpen(false)}
        {...(note ? { defaultNote: note } : {})}
      />
    </>
  )
}
