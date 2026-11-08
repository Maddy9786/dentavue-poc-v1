import type { FC, SVGProps } from 'react'
import { Card } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { SectionHeader } from './SectionHeader'
import { comingSoon } from '@/features/dashboard/mockDashboard'
import CancerIcon from '@/icons/cancer.svg'
import WatchIcon from '@/icons/watch.svg'
import PurseIcon from '@/icons/purse.svg'

/**
 * "Coming soon" — locked feature teasers.
 *
 * Each card's leading icon is the feature's own mark (cancer.svg, watch.svg),
 * which are self-contained chips: they carry their own rounded background and
 * dark glyph, so no wrapper box is needed. The top-right purse.svg is a muted
 * lock-style marker built into the export. The "Coming soon" pill carries the
 * state in text, so it never relies on an icon alone.
 */
const LEFT_ICON: Record<string, FC<SVGProps<SVGSVGElement>>> = {
  'oral-cancer': CancerIcon,
  'apple-watch': WatchIcon,
}

export function ComingSoon() {
  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Coming soon" />
      <ul className="grid grid-cols-2 gap-md">
        {comingSoon.map((item) => {
          const LeftIcon = LEFT_ICON[item.id] ?? CancerIcon
          return (
            <li key={item.id}>
              <Card className="flex h-full flex-col gap-sm p-md">
                <div className="flex items-start justify-between">
                  <LeftIcon aria-hidden="true" className="size-9" />
                  <PurseIcon aria-hidden="true" className="size-5" />
                </div>

                <div className="flex flex-col gap-2xs">
                  <h3 className="text-h2 font-semibold text-foreground">{item.title}</h3>
                  <p className="text-body text-foreground-secondary">{item.description}</p>
                </div>

                {/* text-surface (#FFFFFF) overrides the badge's AA-paired dark
                    text as requested; py-xs makes the pill a touch taller. White
                    on this teal is ~2.5:1 and fails WCAG AA — kept per request. */}
                <Badge tone="secondary" className="mt-auto self-start py-xs text-surface">
                  Coming soon
                </Badge>
              </Card>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
