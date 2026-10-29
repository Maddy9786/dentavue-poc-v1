import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/**
 * Design-system-aware class merger.
 *
 * tailwind-merge resolves conflicts by knowing which utilities belong to the
 * same group — but it only ships knowledge of Tailwind's DEFAULT theme. Our
 * theme is defined in CSS (styles/tokens/*.css), which it cannot read, so every
 * custom token has to be declared here.
 *
 * Without this, `text-on-primary` and `text-h2` both look like `text-*` and are
 * assumed to conflict: the colour is silently dropped and the element renders
 * with inherited text. Observed in practice — `bg-error text-on-error` rendered
 * dark-on-red at 3.12:1 instead of white at 5.32:1. A contrast failure produced
 * by a merge bug, not by the CSS.
 *
 * KEEP IN SYNC with the @theme blocks in styles/tokens/. A token added there and
 * missed here will be stripped at runtime, silently. tests/unit/cn.test.ts guards
 * the pairs that matter.
 */
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      // --text-* in tokens/typography.css → font-size utilities.
      text: ['h1-xl', 'h1-lg', 'h1', 'h2', 'body', 'nav'],

      // --font-weight-* in tokens/typography.css. medium/semibold match
      // Tailwind's defaults; `regular` is ours.
      'font-weight': ['regular'],

      // --spacing-* in tokens/geometry.css → p-, m-, gap-, size- …
      // Without these, `p-md p-lg` does NOT collapse: both classes survive and
      // stylesheet order picks the winner, so overrides silently fail. This is
      // the opposite failure to the colour case above — under-merging, not over.
      spacing: ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl'],

      // --radius-* in tokens/geometry.css → rounded-*
      radius: ['1', '2', '3', '4'],

      // --shadow-* in tokens/effects.css. Stock twMerge already collapses these
      // correctly; declared anyway so the rule stays simple — every token in
      // styles/tokens/ is listed here.
      shadow: ['drop', 'inner', 'elevated', 'website-drop'],

      // --tracking-* in tokens/typography.css. `tight` overrides Tailwind's own
      // value, so it is already a known utility — listed for the same reason.
      tracking: ['tight'],

      // --color-* in tokens/colors.css → every colour utility (bg-, text-,
      // border-, fill-, outline-…).
      color: [
        'primary',
        'secondary',
        'background',
        'surface',
        'surface-secondary',
        'border',
        'foreground',
        'foreground-secondary',
        'foreground-tertiary',
        'on-primary',
        'on-secondary',
        'on-success',
        'on-rating',
        'on-error',
        'on-success-bg',
        'success',
        'success-text',
        'success-bg',
        'error',
        'rating',
      ],
    },
  },
})

/**
 * Merges Tailwind classes, resolving conflicts by last-wins.
 *
 * Plain string concatenation does not work: `"bg-primary bg-surface"` leaves
 * both classes on the element and the winner is decided by stylesheet order,
 * not by intent. twMerge drops the earlier of any conflicting pair, which is
 * what lets a caller override a component's defaults:
 *
 *   cn('bg-primary text-on-primary', 'bg-error text-on-error')
 *   // → 'bg-error text-on-error'
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
