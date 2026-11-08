'use client'

import { useId } from 'react'

/**
 * Number field with up/down steppers, styled to match TextField (52px, 12px
 * radius, white, --shadow-drop).
 *
 * The native spinner is hidden and replaced with explicit chevron buttons so the
 * control looks the same across browsers; each button has an accessible name and
 * the input keeps a real `<label>` and `type="number"` (so keyboard entry and AT
 * work). Values are clamped to [min, max].
 */
interface AgeStepperProps {
  label: string
  value: number
  min?: number
  max?: number
  onChange: (value: number) => void
}

export function AgeStepper({ label, value, min = 1, max = 120, onChange }: AgeStepperProps) {
  const id = useId()
  const clamp = (n: number) => Math.max(min, Math.min(max, n))

  return (
    <div className="w-full">
      <label htmlFor={id} className="mb-sm block text-h2 leading-none font-regular text-foreground">
        {label}
      </label>

      <div className="flex items-center rounded-3 bg-surface pr-md shadow-drop">
        <input
          id={id}
          type="number"
          inputMode="numeric"
          value={value}
          min={min}
          max={max}
          onChange={(e) => onChange(clamp(Number(e.target.value) || min))}
          className="h-13 w-full rounded-3 bg-transparent px-md text-h1 text-foreground outline-none focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        />

        <span className="flex flex-col text-foreground-secondary">
          <button
            type="button"
            aria-label="Increase age"
            onClick={() => onChange(clamp(value + 1))}
            className="flex size-5 items-center justify-center rounded-1 focus-visible:outline-primary focus-visible:outline-2"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
              <path d="M4 10 8 6l4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Decrease age"
            onClick={() => onChange(clamp(value - 1))}
            className="flex size-5 items-center justify-center rounded-1 focus-visible:outline-primary focus-visible:outline-2"
          >
            <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
              <path d="M4 6 8 10l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </span>
      </div>
    </div>
  )
}
