'use client'

import { useEffect } from 'react'
import { useGetAnalysisQuery, type Analysis } from '@/features/scan/analysisApi'
import { useGetScansQuery } from '@/features/scan/scansApi'
import { selectScanDraftId } from '@/features/scan/scanDraftSlice'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { useAppSelector } from '@/store/hooks'

// How often to re-ask while the analysis is running, and how long to keep asking
// before giving up (a server that dies mid-analysis would otherwise poll forever,
// since the row stays `pending`). The screen then falls back to placeholder copy.
const POLL_MS = 2500
const MAX_WAIT_MS = 90_000

/**
 * The AI analysis the result screens should render, or null to fall back.
 *
 * ONE PLACE for the fallback decision, deliberately. Every result screen has to
 * answer the same awkward question — "is there a real analysis for this, and if
 * not what do I show?" — and answering it per screen is how a build ends up with
 * one screen showing live data beside another showing sample copy.
 *
 * Which scan: the one just captured this session if there is one (the draft id,
 * set when POST /scans resolves), otherwise the user's most recent scan, so
 * revisiting `/guided-scan/results` — or opening AI-insight — later still shows
 * real data.
 *
 * ON-DEMAND ANALYSIS: the GET this issues starts analysis server-side when a
 * scan has never had it (opening a results screen is a request to see it), so
 * this hook POLLS until the run lands. Polling stops the moment it is ready or
 * failed, and after MAX_WAIT_MS regardless, so a wedged run never spins forever.
 *
 * Returns null — meaning "render the placeholder content" — when the user is
 * signed out, has no scans, the analysis is still pending, or it failed. The
 * screens keep their hardcoded copy for exactly those cases, which is also what
 * makes the signed-out marketing view work unchanged.
 */
export function useScanAnalysis(): {
  analysis: Analysis | null
  isPending: boolean
  scanId: string | null
  /**
   * A human sentence when the analysis FAILED — most often because the photos
   * were too poor to read (the backend rejects an unreadable capture rather than
   * inventing a perfect score). Null otherwise. Screens show a "retake" state on
   * this instead of the sample copy, so an unusable scan reads as unusable rather
   * than as a flawless 100.
   */
  error: string | null
} {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const draftId = useAppSelector(selectScanDraftId)

  // Only needed to resolve "latest scan" when this isn't a fresh capture.
  const { data: scans } = useGetScansQuery(undefined, { skip: !isAuthenticated || Boolean(draftId) })
  const scanId = draftId ?? (scans?.length ? scans[scans.length - 1]!.id : null)

  const { data, isLoading, refetch } = useGetAnalysisQuery(scanId ?? '', { skip: !scanId })
  const settled = data?.status === 'ready' || data?.status === 'failed'

  // Poll by subscribing to a timer and pulling with refetch() — the sanctioned
  // effect shape (drive an external system, no setState in the body). RTK's own
  // pollingInterval can't be used cleanly here: turning it off when the run
  // settles would need the query's result to configure the query that produced
  // it. The interval clears when `settled` flips (the effect re-runs) or after
  // maxTicks, so a run that never lands stops polling instead of spinning.
  useEffect(() => {
    if (!scanId || settled) return
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
  }, [scanId, settled, refetch])

  return {
    analysis: data?.status === 'ready' ? data : null,
    isPending: Boolean(scanId) && (isLoading || data?.status === 'pending'),
    scanId,
    error: data?.status === 'failed' ? data.error : null,
  }
}
