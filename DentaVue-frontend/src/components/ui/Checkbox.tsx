'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * 24x24 checkbox with a label beside it, per the spec.
 *
 * A real <input type="checkbox">, visually hidden and styled through a sibling,
 * rather than a <div> with a click handler. That keeps Space to toggle, form
 * participation, the native focus ring, and the correct role/checked state for
 * assistive tech — all of which have to be hand-rebuilt (usually badly) the
 * moment you reach for a div.
 *
 * `peer-checked:` drives the visual box from the real input's state, so there is
 * one source of truth and the two cannot disagree. Note the tick is reached with
 * `peer-checked:[&_svg]:opacity-100` rather than putting `peer-checked:` on the
 * tick itself: peer variants compile to a sibling combinator (`.peer:checked ~
 * &`), and the tick is a DESCENDANT of the box, not a sibling of the input — so
 * the plain form silently never matches and the tick never appears.
 *
 * Both the box and the text are labels for the same input, so the sentence is
 * a hit target too — a bare 24px box is a cramped tap target on a phone.
 */

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  children: ReactNode
  error?: string | undefined
}

export function Checkbox({ children, error, className, ...props }: CheckboxProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={cn('w-full', className)}>
      <div className="flex items-start gap-md">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />

        <label
          htmlFor={id}
          className={cn(
            'grid size-6 shrink-0 cursor-pointer place-items-center rounded-1',
            'border-2 border-foreground bg-surface',
            'peer-checked:bg-foreground',
            'peer-checked:[&_svg]:opacity-100',
            // The ring follows the real input, since that is what receives focus.
            'peer-focus-visible:outline-primary peer-focus-visible:outline-2',
            'peer-focus-visible:outline-offset-2',
            error && 'border-error',
          )}
        >
          {/* Decorative: the checked state is already announced by the input. */}
          <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4 opacity-0">
            <path
              d="M3.5 8.5L6.5 11.5L12.5 4.5"
              stroke="var(--color-surface)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </label>

        <label htmlFor={id} className="cursor-pointer">
          {children}
        </label>
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-xs text-h2 text-error">
          {error}
        </p>
      )}
    </div>
  )
}
