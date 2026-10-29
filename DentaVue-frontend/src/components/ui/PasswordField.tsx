'use client'

import { useId, useState, type InputHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'
import EyeIcon from '@/icons/eye.svg'
import EyeOffIcon from '@/icons/eye-off.svg'

/**
 * Password input with a visibility toggle, per the sign-up spec.
 *
 * The toggle is a real <button type="button"> — without the explicit type it
 * defaults to `submit` inside a form and revealing the password would submit
 * it, which is a genuinely baffling bug to hit.
 *
 * Its accessible name changes with state ("Show password" / "Hide password") so
 * a screen-reader user is told what the control will DO, not just that an eye is
 * there. `aria-pressed` reports the current state.
 *
 * `visible` is local: a parent never needs it, and lifting it would invite
 * someone to persist a "show password" preference, which is not a thing to keep.
 */

interface PasswordFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'type'> {
  label: string
  error?: string | undefined
  /** Rendered under the field — the strength hint on sign-up. */
  hint?: React.ReactNode
  /** Show the label above the field (sign-up) rather than visually hidden (sign-in). */
  showLabel?: boolean
  required?: boolean
}

export function PasswordField({
  label,
  error,
  hint,
  showLabel = false,
  required,
  className,
  ...props
}: PasswordFieldProps) {
  const id = useId()
  const errorId = `${id}-error`
  const [visible, setVisible] = useState(false)

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className={
          showLabel
            ? 'mb-sm block text-h2 leading-none font-regular text-foreground'
            : 'sr-only'
        }
      >
        {label}
        {showLabel && required && (
          // The asterisk is decorative; `required` on the input is what actually
          // conveys the requirement to assistive tech.
          <span aria-hidden="true" className="text-error">
            *
          </span>
        )}
      </label>

      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          required={required}
          className={cn(
            'h-13 w-full rounded-3 bg-surface pl-md pr-12 shadow-drop',
            'text-h1 text-foreground',
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

        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          className={cn(
            'absolute inset-y-0 right-0 grid w-12 place-items-center rounded-r-3',
            'text-foreground-secondary',
            'focus-visible:outline-primary focus-visible:outline-2 focus-visible:-outline-offset-2',
          )}
        >
          {visible ? (
            <EyeOffIcon aria-hidden="true" focusable="false" className="size-6" />
          ) : (
            <EyeIcon aria-hidden="true" focusable="false" className="size-6" />
          )}
        </button>
      </div>

      {error ? (
        <p id={errorId} role="alert" className="mt-xs text-h2 text-error">
          {error}
        </p>
      ) : (
        hint
      )}
    </div>
  )
}
