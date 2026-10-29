'use client'

import { useEffect } from 'react'
import { SingleScanCompare } from './SingleScanCompare'
import { TwoScanCompare } from './TwoScanCompare'
import { useScanComparison } from '@/features/scan/useScanComparison'
import {
  BLANK_SCAN_IMAGE,
  comparePair,
  nextScanBanner,
  type DisplayScan,
} from '@/features/scan/scanDisplay'
import { useGetComparisonQuery } from '@/features/scan/analysisApi'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/store/hooks'
import { compareTwo } from '@/features/dashboard/mockDashboard'

// Poll cadence + ceiling while the two scans' analyses are being computed on
// demand. Matches useScanAnalysis so the two flows behave the same.
const POLL_MS = 2500
const MAX_WAIT_MS = 90_000

/**
 * Picks the compare view from auth + captured scans (useScanComparison). Each
 * scan is one guided-scan session; its image is that session's first shot.
 *   - signed out → the two-scan demo (a populated preview);
 *   - signed in, no scans → the single-scan layout with the blank-image
 *     placeholder (nothing uploaded yet);
 *   - signed in, one scan → the single-scan layout with that image;
 *   - signed in, 2+ scans → the first-ever vs. the latest (see comparePair — a
 *     3+ history still compares first against newest, not the last two).
 *
 * This is only reached from Home's "View Scan" — the guided-scan flow does not
 * route here.
 *
 * The metric read-out comes from GET /scans/comparison, which computes it by
 * ARITHMETIC over the two scans' stored bands — no model call. That is why the
 * rows here always agree with what each scan's own results screen showed, and
 * why a badge can never contradict its own values (`Mild → Marked` is
 * arithmetically incapable of reading "Stable").
 *
 * ON-DEMAND ANALYSIS: the comparison GET starts analysis server-side for either
 * scan that has never had it, so opening this screen does the AI call. While it
 * runs the API returns `single: true` (nothing to diff yet) and this component
 * polls until the metrics land, then falls back to the placeholder read-out only
 * if the run ultimately fails.
 */
export function CompareContent() {
  const { mode, scans } = useScanComparison()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { data: comparison, refetch } = useGetComparisonQuery(undefined, { skip: !isAuthenticated })

  const pair = comparePair(scans)
  // Two scans exist but the diff isn't ready — the analyses are still computing.
  const awaitingDiff =
    pair.length >= 2 && (!comparison || comparison.single || comparison.metrics.length === 0)

  // Same timer-subscription poll as useScanAnalysis: pull with refetch(), no
  // setState in the effect. Clears when the diff arrives (awaitingDiff flips) or
  // after maxTicks, so a stuck analysis stops polling rather than spinning.
  useEffect(() => {
    if (!awaitingDiff) return
    let ticks = 0
    const maxTicks = Math.ceil(MAX_WAIT_MS / POLL_MS)
    const id = setInterval(() => {
      ticks += 1
      if (ticks > maxTicks) {
        clearInterval(id)
        return
      }
      void refetch()
    }, POLL_MS)
    return () => clearInterval(id)
  }, [awaitingDiff, refetch])

  if (mode === 'empty') {
    const placeholder: DisplayScan = { id: 'blank', image: BLANK_SCAN_IMAGE, dateLabel: '' }
    return <SingleScanCompare scan={placeholder} />
  }

  if (pair.length >= 2) {
    // First-ever scan vs. the latest. `single: true` from the API means the
    // second scan exists but is not analysed yet — no diff to show, so the
    // placeholder read-out stands in rather than an empty metric list.
    const real =
      comparison && !comparison.single && comparison.metrics.length > 0
        ? {
            ...compareTwo,
            note: comparison.note,
            metrics: comparison.metrics,
            overall: {
              ...compareTwo.overall,
              title: comparison.overall.title,
              subtitle: comparison.overall.subtitle,
              points: comparison.overall.points,
              direction: comparison.overall.direction,
            },
            // Real due date off the latest scan, not the mock's "6 May".
            nextScan: nextScanBanner(comparison.to.capturedAt),
          }
        : compareTwo
    return <TwoScanCompare scans={pair} data={real} />
  }

  // Exactly one scan (only reachable when signed in — demo always has two).
  return <SingleScanCompare scan={pair[0]!} />
}
