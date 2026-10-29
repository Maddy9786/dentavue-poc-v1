import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Small status pill — "Good condition", trend tags like "5%" / "stable".
 *
 * Each tone pairs a fill with its measured `on-` text colour (see colors.css),
 * so contrast is right by construction: the brand fills are light and take dark
 * text, never white. `neutral` is text-on-canvas for low-emphasis tags.
 */
type BadgeTone = 'secondary' | 'success' | 'primary' | 'neutral' | 'muted' | 'error' | 'attention'

const TONES: Record<BadgeTone, string> = {
  secondary: 'bg-secondary text-on-secondary',
  success: 'bg-success text-on-success',
  primary: 'bg-primary text-on-primary',
  neutral: 'bg-background text-foreground-secondary',
  // Visible grey pill on a white card — the "Stable" metric status.
  muted: 'bg-surface-secondary text-foreground-secondary',
  // Red alert pill — the "↓ N Points" indicator. White on red is AA (5.32:1).
  error: 'bg-error text-on-error',
  // Amber pill — the "Attention" risk level. White on this amber is AA (5.31:1).
  // (The token's NAME `success-bg` is a known Figma mislabel; see CLAUDE.md.)
  attention: 'bg-success-bg text-on-success-bg',
}

export function Badge({
  tone = 'secondary',
  className,
  children,
}: {
  tone?: BadgeTone
  className?: string
  children: ReactNode
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-sm py-2xs text-nav font-semibold whitespace-nowrap',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  )
}
