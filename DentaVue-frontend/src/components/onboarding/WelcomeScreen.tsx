'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import TeethIcon from '@/icons/teeth-ai.svg'

/**
 * The DentaVue welcome / splash screen — shared visual for two entry points:
 * the app landing (`/`) and onboarding step 1 (after Create Account). The only
 * difference is where "Get Started" goes, so that's a prop; "Sign In" always
 * points at the sign-in screen.
 *
 * Hero (logo + brand + tagline) and the actions are one centred block — the
 * button sits a fixed 82px below the copy (per the design) rather than being
 * pushed to the bottom of the viewport, so it stays close to the content on tall
 * screens. The column caps at the 375px mobile frame and centres on wider
 * viewports.
 *
 * The brand name and tagline are set in a serif (Georgia, web-safe — no webfont
 * loaded), a deliberate one-off per the splash spec; the rest of the app stays
 * on the app font. The teal tooth logo (teeth-ai.svg) sits on a 158px white disc.
 *
 * Accessibility: "DentaVue" is the page <h1>; the logo is decorative (aria-hidden);
 * both actions have clear names and visible focus. "Sign In" uses the system's
 * accessible link treatment (foreground + underline, matching the auth screens'
 * "Log in") rather than the mockup's teal, which fails AA as text on the canvas.
 */
interface WelcomeScreenProps {
  onGetStarted: () => void
}

export function WelcomeScreen({ onGetStarted }: WelcomeScreenProps) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[375px] flex-col items-center justify-center px-lg py-3xl">
      <div className="flex w-full flex-col items-center gap-[82px]">
        <div className="flex flex-col items-center gap-[42px] text-center">
          <div className="flex size-[158px] items-center justify-center rounded-full bg-surface">
            <TeethIcon aria-hidden="true" className="size-24" />
          </div>

          <div className="flex flex-col gap-md">
            <h1 className="font-serif text-[2rem] leading-none text-foreground">DentaVue</h1>
            <div className="flex flex-col gap-sm">
              <p className="font-serif text-h1-lg text-foreground">The future of oral health.</p>
              <p className="text-h2 text-foreground-secondary">
                AI-powered intelligence that watches over your smile every day, not just twice a
                year.
              </p>
            </div>
          </div>
        </div>

        <div className="flex w-full flex-col gap-md">
          {/* White label per the client's blue/white combination (below AA on the
              fill; kept per client instruction, pending confirmation). */}
          <Button variant="primary" className="text-surface" onClick={onGetStarted}>
            Get Started
          </Button>

          <p className="text-center text-h2 text-foreground-secondary">
            Already have an account?{' '}
            <Link
              href={ROUTES.auth.signin}
              className="rounded-1 font-medium text-foreground underline underline-offset-2 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              Sign In
            </Link>
          </p>
        </div>
      </div>
    </main>
  )
}
