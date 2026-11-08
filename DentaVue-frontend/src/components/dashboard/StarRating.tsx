import { cn } from '@/lib/cn'
import StarIcon from '@/icons/star.svg'

/**
 * Read-only star rating.
 *
 * The whole group is one labelled image ("Rated 3 out of 5"), so a screen reader
 * announces the value once rather than reading five identical stars — and the
 * rating never depends on colour alone, since the number is in the label. Filled
 * stars use the rating token; empties use the border colour.
 */
export function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  const filled = Math.round(rating)
  return (
    <span
      className="inline-flex items-center gap-2xs"
      role="img"
      aria-label={`Rated ${rating} out of ${max}`}
    >
      {Array.from({ length: max }, (_, i) => (
        <StarIcon
          key={i}
          aria-hidden="true"
          className={cn('size-4', i < filled ? 'text-rating' : 'text-border')}
        />
      ))}
    </span>
  )
}
