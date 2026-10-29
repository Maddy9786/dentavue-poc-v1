'use client'

import Image from 'next/image'
import { ScanTile } from './ScanTile'
import { useScanComparison } from '@/features/scan/useScanComparison'
import { BLANK_SCAN_IMAGE, latestScan } from '@/features/scan/scanDisplay'

/**
 * The reference image for AI-insight's "What the scan shows" — a SINGLE image,
 * always the latest scan (its first captured shot), resolved via useScanComparison:
 *
 *   - signed out → the latest demo image;
 *   - signed in, no scans → the blank-image placeholder;
 *   - signed in, with scans → the latest scan's image, with its date chip.
 *
 * Presentational and self-contained, so a server page can drop it in under a
 * heading without becoming a client component itself.
 */
export function ScanShowcase() {
  const { mode, scans } = useScanComparison()
  const latest = latestScan(scans)

  if (mode === 'empty' || !latest) {
    return (
      <div className="relative aspect-[3/2] overflow-hidden rounded-3 bg-border">
        <Image
          src={BLANK_SCAN_IMAGE}
          alt="No scan uploaded yet"
          fill
          sizes="(max-width: 560px) 90vw, 520px"
          className="object-cover"
        />
      </div>
    )
  }

  return (
    <div className="grid grid-cols-1 gap-md">
      {/* 3:2, matching the empty state above and the results carousel — a single
          full-width tile as a square got very tall in the wider web column. */}
      <ScanTile scan={latest} aspect="aspect-[3/2]" />
    </div>
  )
}
