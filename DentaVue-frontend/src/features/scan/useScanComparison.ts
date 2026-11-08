'use client'

import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useGetScansQuery } from './scansApi'
import { demoScans, formatScanDate, BLANK_SCAN_IMAGE, type DisplayScan } from './scanDisplay'

/**
 * What the compare surfaces (home Compare Progress, /compare, AI-insight's "What
 * the scan shows") should show, resolved from auth + the scans fetched from the
 * backend:
 *
 *   - 'demo'  → signed out: the sample images (a populated preview);
 *   - 'empty' → signed in with no scans (or still loading): the blank-image
 *               placeholder;
 *   - 'scans' → signed in with scans: the real images (signed URLs from the
 *               backend), newest last, each with a date chip from its timestamp.
 *
 * The scans come from GET /scans (skipped when signed out), so they survive a
 * reload — the session is restored first (see providers' SessionLoader). One
 * hook so every surface agrees and shares the same source.
 */
export type ScanComparisonMode = 'demo' | 'empty' | 'scans'

export function useScanComparison(): { mode: ScanComparisonMode; scans: DisplayScan[] } {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data } = useGetScansQuery(undefined, { skip: !isAuthenticated })

  if (!isAuthenticated) {
    return { mode: 'demo', scans: demoScans }
  }

  const scans = data ?? []
  if (scans.length === 0) {
    return { mode: 'empty', scans: [] }
  }

  const lastIndex = scans.length - 1
  return {
    mode: 'scans',
    scans: scans.map((scan, i) => ({
      id: scan.id,
      // The backend returns '' when a scan's cover object is gone (see
      // toDto/signImageUrlSafe); show the placeholder rather than a broken image.
      image: scan.imageUrl || BLANK_SCAN_IMAGE,
      dateLabel: formatScanDate(scan.capturedAt),
      // The most recent capture is the "Latest"; earlier ones are the baseline.
      stage: i === lastIndex ? 'Latest' : 'Previous',
      // The stored score, shown as "Score N" under the tile (design match). Null
      // for an unreadable/unanalysed scan → the caption hides itself.
      score: scan.score ?? undefined,
    })),
  }
}
