import type { ComponentType, SVGProps } from 'react'
import type { IntroFeature } from '@/features/onboarding/introFeatures'

/**
 * One value-prop card on onboarding step 2: an icon beside a title and a
 * one-line description.
 *
 * The card is presentational, not interactive — so it is a plain container, not
 * a button/link — with the icon marked decorative (aria-hidden); the title and
 * description carry the meaning. Each icon is a self-contained 40px chip (its
 * own box + glyph, fixed colours), so it renders directly with no wrapper.
 */
interface FeatureCardProps {
  feature: IntroFeature
  icon: ComponentType<SVGProps<SVGSVGElement>>
}

export function FeatureCard({ feature, icon: Icon }: FeatureCardProps) {
  return (
    <div className="flex items-start gap-md rounded-3 border border-border bg-surface p-md shadow-drop">
      <Icon aria-hidden="true" className="size-10 shrink-0" />

      <div className="flex flex-col gap-xs">
        <h2 className="text-h1 font-semibold text-foreground">{feature.title}</h2>
        <p className="text-body text-foreground-secondary">{feature.description}</p>
      </div>
    </div>
  )
}
