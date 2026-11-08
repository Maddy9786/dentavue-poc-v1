'use client'

import { useId, type InputHTMLAttributes, type ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Text input matching the spec: 52px tall, 12px radius, 12px padding, white
 * surface, --shadow-drop.
 *
 * ACCESSIBILITY — the design shows placeholder-only fields ("Email.com"). A
 * placeholder is not a label: it disappears on first keystroke, so the field
 * loses its name exactly when a user needs it to check their answer, and some
 * screen readers skip it entirely. Every field therefore takes a real `label`,
 * rendered visually hidden so the design is unchanged while the accessible name
 * is always present.
 *
 * Errors are wired with aria-invalid + aria-describedby and announced via
 * role="alert", so a screen-reader user hears the problem instead of it only
 * being visible.
 */

interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  /** Accessible name. Visually hidden unless showLabel is set. */
  label: string
  error?: string | undefined
  /**
   * Rendered in the row before the input — e.g. the country-code select.
   * Not named `prefix`: that is a real global HTML attribute typed as string,
   * so it collides with InputHTMLAttributes.
   */
  startSlot?: ReactNode
  /**
   * Draw the label above the field. Sign-in is placeholder-only (label hidden);
   * sign-up shows "Email Address*". Either way the label exists — the hidden
   * variant is about visual design, never about omitting the accessible name.
   */
  showLabel?: boolean
  containerClassName?: string
}

export function TextField({
  label,
  error,
  startSlot,
  showLabel = false,
  required,
  className,
  containerClassName,
  ...props
}: TextFieldProps) {
  const id = useId()
  const errorId = `${id}-error`

  return (
    <div className={cn('w-full', containerClassName)}>
      <label
        htmlFor={id}
        className={
          showLabel ? 'mb-sm block text-h2 leading-none font-regular text-foreground' : 'sr-only'
        }
      >
        {label}
        {showLabel && required && (
          // Decorative: `required` on the input is what conveys this to
          // assistive tech, so the asterisk must not be announced as "star".
          <span aria-hidden="true" className="text-error">
            *
          </span>
        )}
      </label>

      <div className="flex items-center gap-sm">
        {startSlot}
        <input
          id={id}
          required={required}
          className={cn(
            'h-13 w-full rounded-3 bg-surface px-md shadow-drop',
            'text-h1 text-foreground',
            // Placeholder uses foreground-secondary (5.24:1), never
            // foreground-tertiary — that is 2.6:1 and unreadable.
            'placeholder:text-foreground-secondary',
            'outline-none focus-visible:outline-primary focus-visible:outline-2',
            'focus-visible:outline-offset-2',
            error && 'outline-error outline-2',
            className,
          )}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...props}
        />
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-xs px-md text-h2 text-error">
          {error}
        </p>
      )}
    </div>
  )
}
