import type { ReactNode } from 'react'

/**
 * The "Title … meta" row above each dashboard section. The title is a real
 * heading (h2) so the page has a navigable outline; the meta is muted trailing
 * text ("4 areas tracked", "Apr → Jun").
 */
export function SectionHeader({ title, meta }: { title: string; meta?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-sm">
      <h2 className="text-h1 font-semibold text-foreground">{title}</h2>
      {meta && <span className="text-body text-foreground-secondary">{meta}</span>}
    </div>
  )
}
