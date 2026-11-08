'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { FeatureCard } from '@/components/onboarding/FeatureCard'
import { introFeatures } from '@/features/onboarding/introFeatures'
import { ROUTES } from '@/constants/routes'
import AiDetectIcon from '@/icons/ai-detect.svg'
import TrackHealthIcon from '@/icons/track-health.svg'
import ShareProfessionalsIcon from '@/icons/share-professionals.svg'
import BookDateIcon from '@/icons/book-date.svg'

/**
 * Onboarding — step 2: "Intelligence for your whole mouth".
 *
 * A value-prop slide: a step indicator and Skip up top, a two-tone heading, a
 * lead paragraph, then the four feature cards. Presentational — the cards are
 * static content mapped from `introFeatures`.
 *
 * Both Continue and Skip advance to step 3 (create profile) — Skip does not
 * leave onboarding here; it's step 3's Skip/Finish that lands on the dashboard.
 * Icons are wired here, keyed by feature id — each is a self-contained chip SVG.
 */
const ICONS = {
  ai: AiDetectIcon,
  track: TrackHealthIcon,
  share: ShareProfessionalsIcon,
  book: BookDateIcon,
} as const

export default function OnboardingIntroPage() {
  const router = useRouter()

  // Continue and Skip both go to step 3; step 3 is where onboarding exits.
  const goToProfile = () => {
    router.push(ROUTES.onboarding.profile)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[375px] flex-1 flex-col px-lg pt-6 pb-lg">
        <div className="flex items-center justify-between">
          {/* Step indicator — decorative dots plus an sr-only announcement. */}
          <span className="flex items-center gap-2xs" aria-hidden="true">
            <span className="h-1.5 w-6 rounded-full bg-primary" />
            <span className="size-1.5 rounded-full bg-border" />
          </span>
          <span className="sr-only">Step 1 of 2</span>

          <button
            type="button"
            onClick={goToProfile}
            className="rounded-1 text-h2 text-foreground-secondary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Skip
          </button>
        </div>

        <div className="mt-2xl flex flex-col gap-sm">
          <h1 className="text-h1-xl leading-8 font-semibold text-foreground">
            Intelligence for your <span className="text-secondary">whole mouth.</span>
          </h1>
          <p className="text-h2 text-foreground-secondary">
            DentaVue turns a quick selfie into a continuous picture of your oral health.
          </p>
        </div>

        <ul className="mt-2xl flex flex-col gap-md">
          {introFeatures.map((feature) => (
            <li key={feature.id}>
              <FeatureCard feature={feature} icon={ICONS[feature.id]} />
            </li>
          ))}
        </ul>

        {/* White label per the client's blue/white combination (below AA on the
            fill; kept per client instruction, pending confirmation). */}
        <Button variant="primary" className="mt-2xl text-surface" onClick={goToProfile}>
          Continue
        </Button>
      </main>
    </div>
  )
}
