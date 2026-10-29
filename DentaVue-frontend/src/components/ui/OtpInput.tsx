'use client'

import { useId, useRef, type ClipboardEvent, type KeyboardEvent } from 'react'
import { cn } from '@/lib/cn'

/**
 * Six-box one-time-code input.
 *
 * Controlled by a single string — the boxes are a presentation detail, the value
 * is never six pieces of state. That keeps paste, autofill and clearing trivial.
 *
 * ACCESSIBILITY / UX details that are easy to miss and painful to omit:
 *   - `autoComplete="one-time-code"` on the first box lets iOS and Android offer
 *     the SMS code straight from the notification. Without it users retype by
 *     hand, which is the whole point of the screen.
 *   - `inputMode="numeric"` raises the number pad on mobile.
 *   - Paste is handled on every box, not just the first — people paste into
 *     whichever one they happen to focus.
 *   - Backspace on an empty box steps back, which is what everyone expects.
 *   - Each box is labelled "Digit N of 6"; without that a screen reader
 *     announces six anonymous text fields.
 *   - Arrow keys move between boxes.
 */

interface OtpInputProps {
  value: string
  onChange: (value: string) => void
  length?: number
  disabled?: boolean
  /** Announced as the group's name, e.g. "Verification code". */
  label: string
  error?: string | undefined
  /** Fired when the last digit is entered. */
  onComplete?: (value: string) => void
}

export function OtpInput({
  value,
  onChange,
  length = 6,
  disabled,
  label,
  error,
  onComplete,
}: OtpInputProps) {
  const id = useId()
  const errorId = `${id}-error`
  const inputsRef = useRef<Array<HTMLInputElement | null>>([])

  const focusBox = (index: number) => {
    inputsRef.current[Math.min(Math.max(index, 0), length - 1)]?.focus()
  }

  const commit = (next: string) => {
    onChange(next)
    if (next.length === length) onComplete?.(next)
  }

  const handleInput = (index: number, raw: string) => {
    const digit = raw.replace(/\D/g, '').slice(-1)
    if (!digit) return

    const chars = value.padEnd(length, ' ').split('')
    chars[index] = digit
    commit(chars.join('').trimEnd())
    focusBox(index + 1)
  }

  const handleKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Backspace') {
      event.preventDefault()
      const chars = value.padEnd(length, ' ').split('')
      if (chars[index]?.trim()) {
        chars[index] = ' '
        commit(chars.join('').trimEnd())
      } else {
        chars[index - 1] = ' '
        commit(chars.join('').trimEnd())
        focusBox(index - 1)
      }
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault()
      focusBox(index - 1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      focusBox(index + 1)
    }
  }

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault()
    const digits = event.clipboardData.getData('text').replace(/\D/g, '').slice(0, length)
    if (!digits) return
    commit(digits)
    focusBox(digits.length)
  }

  return (
    <div className="w-full">
      <div
        role="group"
        aria-label={label}
        aria-describedby={error ? errorId : undefined}
        className="flex justify-between gap-sm"
      >
        {Array.from({ length }, (_, i) => (
          <input
            key={i}
            ref={(el) => {
              inputsRef.current[i] = el
            }}
            value={value[i]?.trim() ?? ''}
            onChange={(e) => handleInput(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            onPaste={handlePaste}
            disabled={disabled}
            inputMode="numeric"
            autoComplete={i === 0 ? 'one-time-code' : 'off'}
            maxLength={1}
            aria-label={`Digit ${i + 1} of ${length}`}
            aria-invalid={error ? true : undefined}
            className={cn(
              'size-12 rounded-2 text-center',
              'bg-surface-secondary text-foreground',
              'text-h1-lg font-medium',
              'outline-none focus-visible:outline-primary focus-visible:outline-2',
              'focus-visible:outline-offset-2',
              'disabled:opacity-50',
              error && 'outline-error outline-2',
            )}
          />
        ))}
      </div>

      {error && (
        <p id={errorId} role="alert" className="mt-sm text-center text-h2 text-error">
          {error}
        </p>
      )}
    </div>
  )
}
