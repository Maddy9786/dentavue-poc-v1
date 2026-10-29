import { cn } from '@/lib/cn'
import type { MetricTone } from '@/features/dashboard/mockDashboard'

/**
 * Dot + label for a health metric's state ("Improving", "Watch").
 *
 * Per design, every state uses the same accent (#2FB6A0 = var(--color-secondary))
 * for both the dot and the word — "Watch" reads in the same teal as "Normal" /
 * "Healthy", not amber. The word still carries the meaning, so colour is not the
 * only status cue. (The `tone` prop is kept so a future design can re-introduce a
 * distinct colour per state without touching call sites.)
 *
 * Note: teal text on the light card is below WCAG AA for body text (the same
 * trade-off flagged elsewhere on this screen). Kept per the design request; the
 * underlying tokens are untouched.
 */
const TONE: Record<MetricTone, { dot: string; text: string }> = {
  positive: { dot: 'bg-secondary', text: 'text-secondary' },
  watch: { dot: 'bg-secondary', text: 'text-secondary' },
}

export function StatusIndicator({ tone, label }: { tone: MetricTone; label: string }) {
  const c = TONE[tone]
  return (
    <span className="inline-flex items-center gap-xs">
      <span className={cn('size-1.5 shrink-0 rounded-full', c.dot)} aria-hidden="true" />
      <span className={cn('text-body font-medium', c.text)}>{label}</span>
    </span>
  )
}
