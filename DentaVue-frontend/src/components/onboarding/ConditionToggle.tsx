import type { ComponentType, SVGProps } from 'react'
import type { HealthCondition } from '@/features/onboarding/profileFields'

/**
 * A health-condition row: icon + label + on/off switch, in a white card.
 *
 * The whole card is the control's `<label>`, so tapping anywhere toggles it and
 * the switch's accessible name is the condition ("Smoking"). The input is a
 * native checkbox with `role="switch"` (visually hidden, still focusable), so
 * assistive tech announces it as an on/off switch. On is `bg-success` (green),
 * matching the design, and the thumb slides right. Both the track colour and the
 * (nested) thumb key off `group-has-[:checked]` — not `peer-checked`, which only
 * reaches the checkbox's siblings, so it can't move a thumb nested in the track.
 * The icon is decorative.
 */
interface ConditionToggleProps {
  condition: HealthCondition
  icon: ComponentType<SVGProps<SVGSVGElement>>
  checked: boolean
  onChange: (checked: boolean) => void
}

export function ConditionToggle({ condition, icon: Icon, checked, onChange }: ConditionToggleProps) {
  return (
    <label className="group flex cursor-pointer items-center gap-md rounded-3 border border-border bg-surface p-md shadow-drop">
      <input
        type="checkbox"
        role="switch"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="peer sr-only"
      />

      <Icon aria-hidden="true" className="size-6 shrink-0 text-foreground" />
      <span className="flex-1 text-h1 text-foreground">{condition.label}</span>

      <span className="relative h-6 w-11 shrink-0 rounded-full bg-border transition-colors group-has-[:checked]:bg-success peer-focus-visible:outline-primary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2">
        <span className="absolute top-0.5 left-0.5 size-5 rounded-full bg-surface shadow-drop transition-transform group-has-[:checked]:translate-x-5" />
      </span>
    </label>
  )
}
