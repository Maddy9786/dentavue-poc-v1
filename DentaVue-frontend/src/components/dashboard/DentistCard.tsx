import Image from 'next/image'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { StarRating } from './StarRating'
import type { Dentist } from '@/features/dashboard/mockDashboard'
import DocTagIcon from '@/icons/doc-tag.svg'

/**
 * A recommended-dentist row. Fully data-driven from the `dentist` prop (see the
 * note on the Dentist type) so an API result renders without touching this file.
 *
 * The portrait fills the left column and stretches to the card's height — up to
 * and including the Book Now button — via `self-stretch` on a relative
 * container with a `fill` image, so it tracks however tall the details column
 * gets. Book Now delegates to `onBook`; the parent owns the popup, so one dialog
 * serves every card.
 */
export function DentistCard({ dentist, onBook }: { dentist: Dentist; onBook: () => void }) {
  return (
    <Card className="flex gap-md p-md">
      <div className="relative w-28 shrink-0 self-stretch overflow-hidden rounded-3 bg-border">
        <Image
          src={dentist.image}
          alt={`Portrait of ${dentist.name}`}
          fill
          sizes="112px"
          className="object-cover"
        />
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2xs">
        <h3 className="text-h2 font-semibold text-foreground">{dentist.name}</h3>

        <span className="inline-flex items-center gap-xs text-body text-foreground-secondary">
          {/* No colour class: the icon uses currentColor, so it inherits the
              span's foreground-secondary and matches the specialty text exactly. */}
          <DocTagIcon aria-hidden="true" className="size-4" />
          {dentist.specialty}
        </span>

        <div className="flex flex-wrap items-center gap-x-sm gap-y-2xs">
          <StarRating rating={dentist.rating} />
          <span className="text-body text-foreground-secondary">{dentist.reviews} Reviews</span>
        </div>

        <span className="text-body text-foreground-secondary">
          Starts at <span className="font-semibold text-foreground">{dentist.startsAt}</span>
        </span>

        {/* text-surface (#FFFFFF) is an explicit override of the primary button's
            AA-paired dark text, requested for this button. White on this blue is
            ~2.9:1 and fails WCAG AA — kept because it was asked for. */}
        <Button variant="primary" className="mt-xs h-10 text-h2 text-surface" onClick={onBook}>
          Book Now
        </Button>
      </div>
    </Card>
  )
}
