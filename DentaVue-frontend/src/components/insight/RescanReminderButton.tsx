'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/**
 * The AI-insight page's primary CTA ("Set a re-scan reminder").
 *
 * Reminders aren't built, so — like the other coming-soon actions across the app
 * (booking, profile, insights) — the button opens a shared "coming soon" dialog
 * rather than doing nothing. When a reminder/notification API exists, this is the
 * one place to wire it.
 */
export function RescanReminderButton({ label }: { label: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      {/* Primary blue + white per the client's combination (below AA on the fill;
          kept per client instruction, pending confirmation). */}
      <Button variant="primary" className="text-surface" onClick={() => setOpen(true)}>
        {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title="Re-scan reminder">
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">
            Reminders are coming soon — you&apos;ll be able to schedule a re-scan and get a nudge
            when it&apos;s due.
          </p>
          <Button variant="primary" className="text-surface" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  )
}
