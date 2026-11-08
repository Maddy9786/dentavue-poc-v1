import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * Surface container — the white rounded panel most sections sit on.
 *
 * Semantic tokens only: `bg-surface` (white) on the app's `bg-background`,
 * `rounded-4` (16px, the largest Figma radius) and the Figma "Drop shadow"
 * (`shadow-drop`). Padding defaults to `p-lg` (16px) and is overridable via
 * className, which merges last through cn().
 */
export function Card({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { children: ReactNode }) {
  return (
    <div className={cn('rounded-4 bg-surface p-lg shadow-drop', className)} {...props}>
      {children}
    </div>
  )
}
