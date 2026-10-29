import { cn } from '@/lib/cn'

/**
 * A toggleable "oral goal" chip (multi-select).
 *
 * A real `<button>` with `aria-pressed`, so screen readers announce it as a
 * toggle and its state; selected chips fill `bg-primary` and show a check. The
 * selected text (and check, via currentColor) is white (`text-surface`) — the
 * client's blue+white combination. This is below WCAG AA (~2.9:1), kept per the
 * client's instruction pending confirmation; swap `aria-pressed:text-surface`
 * for `text-on-primary` to restore the AA pairing.
 */
interface GoalChipProps {
  label: string
  pressed: boolean
  onToggle: () => void
}

export function GoalChip({ label, pressed, onToggle }: GoalChipProps) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-xs rounded-full border px-md py-sm text-h2 font-medium transition-colors',
        'border-border bg-surface text-foreground shadow-drop',
        'aria-pressed:border-transparent aria-pressed:bg-primary aria-pressed:text-surface',
        'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
      )}
    >
      {pressed && (
        <svg viewBox="0 0 16 16" fill="none" aria-hidden="true" className="size-4">
          <path
            d="M13 4.5 6.5 11.5 3 8"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      {label}
    </button>
  )
}
