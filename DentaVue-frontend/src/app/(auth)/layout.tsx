import type { ReactNode } from 'react'

/**
 * Chrome shared by every auth screen.
 *
 * Mobile-first: the design is a 375px frame, so the base styles ARE the mobile
 * layout — full-bleed, 16px gutters. No media query is needed to reach it.
 *
 * Desktop is the adaptation. Rather than stretch a 343px-wide form across a
 * 1440px monitor — which would leave one absurdly long input — the same column
 * is capped at its designed width and centred, which is the conventional
 * treatment for auth and reads as deliberate at any size. A modal was the other
 * option but is wrong here: these are addressable pages, they must deep-link
 * and survive a refresh, and there is nothing behind them to be modal over.
 *
 * `my-auto` centres the column vertically instead of a fixed top margin. Auth
 * screens are short, so a top-aligned column dumps all the leftover height at
 * the bottom and looks dropped rather than placed — and any fixed `mt` that
 * fixes one viewport is wrong on the next.
 *
 * Auto margins, NOT `items-center`/`justify-center`: when the content is taller
 * than the viewport — a long error, a small phone, or a reader who has scaled
 * their text up — centring alignment overflows in BOTH directions and the top
 * becomes unreachable, scrollbar or not. Auto margins collapse to zero instead,
 * so the column simply pins to the top and scrolls normally.
 *
 * `py-3xl` is the floor that keeps it off the edges once the auto margins have
 * collapsed.
 *
 * `min-h-dvh` (not `min-h-screen`): dvh tracks mobile browser chrome that shows
 * and hides on scroll, so the column doesn't jump as the toolbar retracts.
 *
 * No status bar is drawn — the phone supplies its own.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh justify-center bg-background">
      <main className="my-auto flex w-full max-w-[375px] flex-col px-lg py-3xl">{children}</main>
    </div>
  )
}
