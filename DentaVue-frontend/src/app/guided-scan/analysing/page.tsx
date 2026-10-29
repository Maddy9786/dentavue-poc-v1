import type { Metadata } from 'next'
import { AnalysingScan } from '@/components/scan/AnalysingScan'

export const metadata: Metadata = {
  title: 'Analysing your scan',
}

/**
 * The analysing progress screen — the step after "Analyse" on the Quality check,
 * before the results. It plays a progress animation while the scan is (in future)
 * analysed, then moves on to the comparison.
 *
 * The animation and auto-advance are client behaviour, so the whole screen is one
 * client island; the server component only carries the route metadata. Not
 * route-protected, same as the rest of the flow.
 */
export default function AnalysingScanPage() {
  return <AnalysingScan />
}
