import type { Metadata } from 'next'
import type { ComponentType, SVGProps } from 'react'
import { Card } from '@/components/ui/Card'
import { BackButton } from '@/components/ui/BackButton'
import { ScanNowButton } from '@/components/scan/ScanNowButton'
import { guidedScan, type GuidedScanIcon } from '@/features/dashboard/mockDashboard'
import { ROUTES } from '@/constants/routes'
import LightingIcon from '@/icons/lightenng.svg'
import SmileIcon from '@/icons/smile.svg'
import TongueIcon from '@/icons/tongue.svg'
import TiltUpperIcon from '@/icons/tilt-upper.svg'
import TiltLowerIcon from '@/icons/tilt-lower.svg'
import OneIcon from '@/icons/one.svg'
import TwoIcon from '@/icons/two.svg'
import ThreeIcon from '@/icons/three.svg'
import FourIcon from '@/icons/four.svg'
import FiveIcon from '@/icons/five.svg'

export const metadata: Metadata = {
  title: 'Guided Scan',
}

/** The step glyphs are pristine Figma exports (all #221E19 → var(--color-foreground)
 *  via the SVGR mapping), so they render as the design's dark line icons. */
const STEP_ICONS: Record<GuidedScanIcon, ComponentType<SVGProps<SVGSVGElement>>> = {
  lighting: LightingIcon,
  smile: SmileIcon,
  tongue: TongueIcon,
  'tilt-upper': TiltUpperIcon,
  'tilt-lower': TiltLowerIcon,
}

/** Number chips 1–5 are self-contained Figma exports (own #ECE7DF rounded box +
 *  digit), so they render directly — one per step, in order. */
const STEP_NUMBERS: ComponentType<SVGProps<SVGSVGElement>>[] = [
  OneIcon,
  TwoIcon,
  ThreeIcon,
  FourIcon,
  FiveIcon,
]

/**
 * Guided Scan — the first screen of the scan flow, and the funnel every "Scan
 * Now" entry point now opens (the home hero card, the bottom-nav scan tile, the
 * compare CTA) instead of jumping straight to the camera. It preps the user with
 * five framing steps for an accurate reading; its "Scan Now" CTA advances to the
 * photo-capture screen (ScanNowButton → /guided-scan/capture), where the camera
 * opens.
 *
 * A server component: the steps are static instructional copy (guidedScan in
 * mockDashboard), so only the back arrow and the CTA are interactive islands. Not
 * route-protected — same reasoning as the other screens (auth is in memory, a
 * guard would bounce a real user on refresh). Layout mirrors compare / ai-insight:
 * the 375px mobile frame as the base, widening modestly on desktop.
 */
export default function GuidedScanPage() {
  const { lead, highlight, intro, steps, ctaLabel } = guidedScan

  return (
    <main className="flex min-h-dvh flex-col bg-background">
      <div className="mx-auto flex w-full app-column flex-1 flex-col gap-2xl px-lg pt-14 pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Guided Scan</h1>
        </header>

        {/* Lead + intro. The highlight ("perfect scan.") is the design's primary
            accent within the sentence. */}
        <div className="flex flex-col gap-xs">
          <h2 className="text-h2 font-semibold text-foreground">
            {lead} <span className="text-primary">{highlight}</span>
          </h2>
          <p className="text-body text-foreground-secondary">{intro}</p>
        </div>

        {/* The five prep steps. An ordered list carries the sequence to assistive
            tech; the visible number chips are decorative (aria-hidden). */}
        <ol className="flex flex-col gap-md">
          {steps.map((step, i) => {
            const Icon = STEP_ICONS[step.icon]
            const NumberChip = STEP_NUMBERS[i]!
            return (
              <li key={step.id}>
                <Card className="flex items-center gap-md">
                  <NumberChip aria-hidden="true" className="size-8 shrink-0" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-h2 font-semibold text-foreground">{step.title}</span>
                    <span className="text-body text-foreground-secondary">{step.detail}</span>
                  </div>
                  <Icon aria-hidden="true" className="size-6 shrink-0 text-foreground" />
                </Card>
              </li>
            )
          })}
        </ol>

        {/* Capture step: the only entry point that actually opens the camera. It
            follows the steps directly (no bottom-pin) so it stays near the copy,
            with a little extra breathing room above it. */}
        <div className="pt-30">
          <ScanNowButton label={ctaLabel} />
        </div>
      </div>
    </main>
  )
}
