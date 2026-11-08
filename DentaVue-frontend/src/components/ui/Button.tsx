import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Button primitive.
 *
 * Rules every UI primitive follows:
 *   1. Semantic utilities only — bg-primary, never bg-[#3B9DF0] or bg-blue-500.
 *   2. Each fill takes its matching `on-` text token, so contrast is right by
 *      construction rather than by memory. They are NOT interchangeable: the
 *      brand fills are light and need dark text; error is dark and needs white.
 *   3. Variants are a lookup keyed by a union, so an unhandled variant is a type
 *      error, not a silently unstyled button.
 *   4. `className` merges last via cn(), so callers override without fighting
 *      stylesheet order.
 *
 * The spec gives button labels 16px / line-height 100%, hence `leading-none`.
 * The type scale keeps 1.4 for 16px prose — see tokens/typography.css.
 */

type ButtonVariant = 'primary' | 'secondary' | 'surface'

const VARIANTS: Record<ButtonVariant, string> = {
  // Solid CTA. The design draws white text here, but white on this blue is
  // 2.89:1 and fails WCAG AA; text-on-primary is dark and reaches 5.73:1.
  primary: 'bg-primary text-on-primary shadow-drop',
  // Solid teal — the OTP screen's Verify button. Same story: 6.56:1 with dark.
  secondary: 'bg-secondary text-on-secondary shadow-drop',
  // White card button — the "Continue with …" rows. 16.56:1.
  surface: 'bg-surface text-foreground shadow-drop',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  /** Rendered before the label, inside the same flex row. */
  icon?: ReactNode
  fullWidth?: boolean
  children: ReactNode
}

export function Button({
  variant = 'primary',
  icon,
  fullWidth = true,
  className,
  type = 'button',
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        // h-13 = 52px, the input/button height from the spec.
        'inline-flex h-13 items-center justify-center gap-sm rounded-3 px-md',
        'text-h1 leading-none font-medium',
        'transition-opacity active:opacity-80',
        // Focus must stay visible for keyboard users — never remove this.
        'focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2',
        'disabled:pointer-events-none disabled:opacity-50',
        fullWidth && 'w-full',
        VARIANTS[variant],
        className,
      )}
      {...props}
    >
      {icon}
      {children}
    </button>
  )
}
