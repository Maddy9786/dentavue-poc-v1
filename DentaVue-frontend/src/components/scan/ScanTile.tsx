import Image from 'next/image'
import { cn } from '@/lib/cn'
import type { DisplayScan } from '@/features/scan/scanDisplay'

/**
 * One scan image tile — the date chip (top-right), the stage label (bottom-left),
 * and the "Score N" caption below. Shared by home's Compare Progress and the
 * /compare views so they render scans identically.
 *
 * A fresh capture's `image` is a data: URL (straight off the camera canvas), so
 * it's drawn with a plain <img> — next/image's optimizer has nothing to do with
 * an inline data URL. Static demo/placeholder paths go through next/image. Chips
 * and caption only render when the data is present, so the placeholder (blank
 * image, no date/score) shows just the image.
 */
export function ScanTile({
  scan,
  aspect = 'aspect-square',
}: {
  scan: DisplayScan
  aspect?: string
}) {
  const isDataUrl = scan.image.startsWith('data:')
  const alt = scan.stage
    ? `${scan.stage} scan${scan.dateLabel ? ` from ${scan.dateLabel}` : ''}`
    : scan.dateLabel
      ? `Scan from ${scan.dateLabel}`
      : 'Scan placeholder'

  return (
    <figure className="flex flex-col gap-xs">
      <div className={cn('relative overflow-hidden rounded-3 bg-border', aspect)}>
        {isDataUrl ? (
          // A data: URL from the camera canvas, not a remote asset — next/image
          // adds nothing here.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={scan.image} alt={alt} className="absolute inset-0 size-full object-cover" />
        ) : (
          <Image
            src={scan.image}
            alt={alt}
            fill
            sizes="(max-width: 560px) 45vw, 260px"
            className="object-cover"
          />
        )}

        {scan.dateLabel && (
          <span className="absolute top-sm right-sm rounded-2 bg-foreground px-sm py-2xs text-nav font-medium text-surface">
            {scan.dateLabel}
          </span>
        )}
        {scan.stage && (
          <span className="absolute bottom-sm left-sm rounded-2 bg-foreground/85 px-sm py-2xs text-nav font-medium text-surface">
            {scan.stage}
          </span>
        )}
      </div>

      {scan.score != null && (
        <figcaption className="text-body text-foreground-secondary">Score {scan.score}</figcaption>
      )}
    </figure>
  )
}
