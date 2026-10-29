'use client'

import Image from 'next/image'
import { SectionHeader } from './SectionHeader'
import { ViewScanButton } from './ViewScanButton'
import { ScanTile } from '@/components/scan/ScanTile'
import { useScanComparison } from '@/features/scan/useScanComparison'
import { BLANK_SCAN_IMAGE, comparePair } from '@/features/scan/scanDisplay'

/**
 * "Compare Progress" — the home preview of a user's scans.
 *
 * What it shows depends on auth + captures (via useScanComparison):
 *   - signed out → the demo images (a populated preview);
 *   - signed in, no scans → the blank-image placeholder ("no scans yet");
 *   - signed in, with scans → the first-ever vs. the latest (or the single one),
 *     each with a date chip from its capture time.
 *
 * The tiles read only from the resolved scans (comparePair — the same first-vs-
 * latest rule as the /compare screen it opens via "View Scan").
 */
export function CompareProgress() {
  const { mode, scans } = useScanComparison()
  const shown = comparePair(scans)

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Compare Progress" meta={<ViewScanButton />} />

      {mode === 'empty' ? (
        <figure className="flex flex-col gap-xs">
          <div className="relative aspect-[3/2] overflow-hidden rounded-3 bg-border">
            <Image
              src={BLANK_SCAN_IMAGE}
              alt="No scan uploaded yet"
              fill
              sizes="(max-width: 560px) 90vw, 520px"
              className="object-cover"
            />
          </div>
          <figcaption className="text-body text-foreground-secondary">
            No scans yet — take your first scan to start comparing.
          </figcaption>
        </figure>
      ) : (
        <div className={shown.length > 1 ? 'grid grid-cols-2 gap-md' : 'grid grid-cols-1 gap-md'}>
          {shown.map((scan) => (
            <ScanTile key={scan.id} scan={scan} aspect="aspect-[4/3]" />
          ))}
        </div>
      )}
    </section>
  )
}
