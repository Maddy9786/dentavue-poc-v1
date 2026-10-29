import type { ComponentType, SVGProps } from 'react'
import { cn } from '@/lib/cn'
import type { PersonaOption as PersonaOptionData } from '@/features/onboarding/personaOptions'

/**
 * One selectable persona card in the onboarding radio group.
 *
 * It is a real `<input type="radio">` wrapped in its `<label>`, so keyboard
 * (arrow-key) navigation, focus, and screen-reader semantics come for free; the
 * input is visually hidden (`sr-only`) but still focusable, and the card's
 * selected/focus styling keys off it via `has-[:checked]` / `has-[:focus-visible]`.
 *
 * The selected card fills with `bg-primary` and switches its text to white
 * (`text-surface` = #FFFFFF) — the client's chosen blue+white combination. Note
 * this is below WCAG AA (white on the brand blue is ~2.9:1); kept per the
 * client's explicit instruction, pending their confirmation. To restore the
 * system's AA-safe pairing, swap the two `group-has-[:checked]:text-surface`
 * below for `text-on-primary`.
 *
 * The `icon` is a SELF-CONTAINED chip — the SVG carries its own dark rounded
 * square plus a white glyph — so it renders directly at chip size with no
 * wrapper or colour handling; the dark square stays dark on the blue card too,
 * matching the mockup.
 */
interface PersonaOptionProps {
  option: PersonaOptionData
  icon: ComponentType<SVGProps<SVGSVGElement>>
  /** Shared radio group name — same for every option so they're mutually exclusive. */
  name: string
  defaultChecked?: boolean
  onSelect: (option: PersonaOptionData) => void
}

export function PersonaOption({
  option,
  icon: Icon,
  name,
  defaultChecked,
  onSelect,
}: PersonaOptionProps) {
  return (
    <label
      className={cn(
        'group relative flex cursor-pointer items-center gap-md rounded-3 border p-md',
        'border-border bg-surface transition-colors',
        'has-[:checked]:border-transparent has-[:checked]:bg-primary',
        'has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2',
      )}
    >
      <input
        type="radio"
        name={name}
        value={option.id}
        defaultChecked={defaultChecked}
        onChange={() => onSelect(option)}
        className="peer sr-only"
      />

      <Icon aria-hidden="true" className="size-12 shrink-0" />

      <span className="flex flex-1 flex-col gap-2xs">
        <span className="text-h2 font-semibold text-foreground group-has-[:checked]:text-surface">
          {option.title}
        </span>
        <span className="text-body text-foreground-secondary group-has-[:checked]:text-surface">
          {option.description}
        </span>
      </span>

      {/* Indicator: an empty ring, becoming a white disc with a check when chosen. */}
      <span className="relative size-6 shrink-0" aria-hidden="true">
        <span className="absolute inset-0 rounded-full border-2 border-foreground-tertiary group-has-[:checked]:hidden" />
        <span className="absolute inset-0 hidden items-center justify-center rounded-full bg-surface text-primary group-has-[:checked]:flex">
          <svg viewBox="0 0 16 16" fill="none" className="size-4">
            <path
              d="M13 4.5 6.5 11.5 3 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
    </label>
  )
}
