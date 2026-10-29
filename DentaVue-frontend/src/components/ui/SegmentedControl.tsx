'use client'

import { useId } from 'react'
import { cn } from '@/lib/cn'

/**
 * Single-select segmented control — a row of pill segments where one is active.
 *
 * Built on native radios (visually hidden, still focusable) wrapped in labels,
 * so it is a real radio group: arrow-key navigation, focus, and screen-reader
 * semantics come for free. `label` names the group (aria-label on the
 * radiogroup). The selected segment fills with `bg-primary` and white text
 * (`text-surface`) — the client's blue+white combination. This is below WCAG AA
 * (~2.9:1) and kept per the client's instruction, pending confirmation; swap
 * `peer-checked:text-surface` for `text-on-primary` to restore the AA pairing.
 */
interface SegmentedControlProps<T extends string> {
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
  name: string
}

export function SegmentedControl<T extends string>({
  label,
  options,
  value,
  onChange,
  name,
}: SegmentedControlProps<T>) {
  const groupId = useId()

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="flex gap-2xs rounded-3 bg-surface p-2xs shadow-drop"
    >
      {options.map((option) => {
        const id = `${groupId}-${option.value}`
        return (
          <label key={option.value} htmlFor={id} className="flex-1">
            <input
              id={id}
              type="radio"
              name={name}
              value={option.value}
              checked={value === option.value}
              onChange={() => onChange(option.value)}
              className="peer sr-only"
            />
            <span
              className={cn(
                'flex cursor-pointer items-center justify-center rounded-2 py-sm text-h2 font-medium',
                'bg-border text-foreground transition-colors',
                'peer-checked:bg-primary peer-checked:text-surface',
                'peer-focus-visible:outline-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2',
              )}
            >
              {option.label}
            </span>
          </label>
        )
      })}
    </div>
  )
}
