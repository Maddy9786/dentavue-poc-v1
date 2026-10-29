'use client'

import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

/**
 * Accessible modal / bottom sheet.
 *
 * Portalled to <body> so it escapes the fixed bottom-nav stacking context. It is
 * a real dialog: role="dialog" + aria-modal, labelled by its title, closeable by
 * Escape, the backdrop, or the header close button. On open it moves focus into
 * the panel and locks body scroll; on close it restores focus to whatever was
 * focused before (the nav item that opened it).
 *
 * Not a full focus trap — Tab can still leave the panel — which is an accepted
 * limitation for these short, single-purpose popups; Escape and an explicit
 * close are always available.
 *
 * Mobile-first: a bottom sheet on small screens (where the trigger lives at the
 * bottom), centred on larger ones.
 */
export function Modal({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  className?: string
}) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    if (!open) return

    const previouslyFocused = document.activeElement as HTMLElement | null
    panelRef.current?.focus()

    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      previouslyFocused?.focus?.()
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-lg">
      <div className="absolute inset-0 bg-foreground/50" onClick={onClose} aria-hidden="true" />

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          'relative z-10 w-full max-w-[440px] rounded-t-4 bg-surface p-lg pb-xl shadow-elevated outline-none sm:rounded-4 sm:pb-lg',
          className,
        )}
      >
        <div className="flex items-center justify-between gap-sm">
          <h2 id={titleId} className="text-h1 font-semibold text-foreground">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-8 items-center justify-center rounded-full text-h1-lg text-foreground-secondary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>

        <div className="mt-md">{children}</div>
      </div>
    </div>,
    document.body,
  )
}
