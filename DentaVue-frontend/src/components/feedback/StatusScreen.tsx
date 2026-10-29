import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/**
 * The shared visual for a full-screen status message — 404, an error boundary,
 * the offline overlay. One component so all three read as the same system: the
 * same warm background, the same tonal icon disc, the same title/description
 * rhythm, the same action stack.
 *
 * Semantic tokens only, and the app is light-theme only (no dark palette exists
 * yet — see styles/tokens/colors.css), so nothing here hardcodes a colour or
 * invents a dark value. Each icon disc uses an accessible fill+text PAIR
 * (`bg-error`/`text-on-error`), never a lone fill with guessed text.
 */

export type StatusTone = 'error' | 'neutral'

/** Fill + on-fill pairs, so the glyph contrast is right by construction. */
const TONE_DISC: Record<StatusTone, string> = {
  error: 'bg-error text-on-error', // white glyph on red, 5.32:1
  neutral: 'bg-border text-foreground', // dark glyph on warm-100
}

/**
 * The centred column shared by the page screens and the offline overlay. It is
 * NOT a landmark on its own — the wrapper supplies `<main>` (a page) or the
 * dialog role (the overlay) — so it can be dropped into either without creating
 * a second `main` or a nested dialog.
 *
 * `headingId`/`descId` let a dialog wrapper wire `aria-labelledby` /
 * `aria-describedby` to the real title and description.
 */
export function StatusContent({
  tone,
  icon,
  eyebrow,
  title,
  description,
  footnote,
  actions,
  headingId,
  descId,
}: {
  tone: StatusTone
  icon: ReactNode
  /** Small label above the title, e.g. "404". */
  eyebrow?: string
  title: string
  description: string
  /** Tiny muted line under the copy — e.g. an error reference id. */
  footnote?: ReactNode
  /** Action buttons; stacked full-width beneath the copy. */
  actions?: ReactNode
  headingId?: string
  descId?: string
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-lg text-center">
        <span
          aria-hidden="true"
          className={cn('grid size-20 place-items-center rounded-full', TONE_DISC[tone])}
        >
          {icon}
        </span>
        <div className="flex flex-col gap-sm">
          {eyebrow && (
            <span className="text-h2 font-semibold tracking-tight text-foreground-secondary">
              {eyebrow}
            </span>
          )}
          {/* h1-lg (20/1.5), not h1-xl (24/1) — these titles can wrap on a narrow
              screen, and the taller line-height keeps a wrapped title readable. */}
          <h1 id={headingId} className="text-h1-lg font-semibold text-foreground">
            {title}
          </h1>
          <p id={descId} className="max-w-[300px] text-body text-foreground-secondary">
            {description}
          </p>
          {footnote && <p className="pt-xs text-nav text-foreground-secondary">{footnote}</p>}
        </div>
      </div>

      {actions && <div className="flex w-full max-w-[320px] flex-col gap-sm">{actions}</div>}
    </>
  )
}

/**
 * A full-screen status PAGE — the `<main>` landmark for not-found / error routes.
 * The offline overlay uses StatusContent directly inside its dialog instead.
 */
export function StatusScreen(props: Parameters<typeof StatusContent>[0]) {
  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full app-column flex-1 flex-col items-center justify-center gap-3xl px-lg py-2xl">
        <StatusContent {...props} />
      </div>
    </main>
  )
}
