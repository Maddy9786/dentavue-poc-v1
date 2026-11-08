'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'

/**
 * A results-screen action ("Book a specialist", "Remind me", "Generate Report")
 * whose real behaviour isn't built yet: it opens a short "coming soon" popup, the
 * same treatment the bottom-nav placeholders use.
 *
 * `variant` picks the fill; `whiteLabel` applies the client's white-on-fill
 * treatment for the solid CTAs (below AA, kept per instruction) — off for the
 * muted secondary buttons, which keep their AA-paired dark text.
 */
export function ComingSoonButton({
  label,
  message,
  variant = 'primary',
  whiteLabel = false,
  className,
}: {
  label: string
  message: string
  variant?: 'primary' | 'secondary' | 'surface'
  whiteLabel?: boolean
  className?: string
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        variant={variant}
        className={[whiteLabel ? 'text-surface' : '', className].filter(Boolean).join(' ')}
        onClick={() => setOpen(true)}
      >
        {label}
      </Button>

      <Modal open={open} onClose={() => setOpen(false)} title={label}>
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">{message}</p>
          {/* Primary blue + white per the client's combination (below AA on the
              fill; kept per client instruction, pending confirmation). */}
          <Button variant="primary" className="text-surface" onClick={() => setOpen(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </>
  )
}
