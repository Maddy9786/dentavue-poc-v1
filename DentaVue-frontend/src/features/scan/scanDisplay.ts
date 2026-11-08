import { progressPhotos } from '@/features/dashboard/mockDashboard'

/**
 * A scan as the UI renders it — one shape for demo scans, real captured scans,
 * and the empty placeholder, so the tiles (ScanTile) and compare views don't
 * care where the image came from.
 *
 * `stage`/`score` are optional: demo scans carry both ("Previous", "Score 78"),
 * a freshly captured scan has neither yet (the AI score isn't computed), and the
 * placeholder has just the blank image.
 */
export interface DisplayScan {
  id: string
  /** A public path (demo / placeholder) or a data: URL (a fresh capture). */
  image: string
  /** Chip text derived from the capture date; '' hides the chip. */
  dateLabel: string
  stage?: string
  score?: number
}

/** Placeholder shown when a signed-in user has no scans yet. */
export const BLANK_SCAN_IMAGE = '/images/blank-image.png'

/**
 * The default scans shown to a signed-out visitor — the sample images already on
 * the home page. Signed-out users get these instead of the blank placeholder.
 */
export const demoScans: DisplayScan[] = progressPhotos.map((photo) => ({
  id: photo.id,
  image: photo.image,
  dateLabel: photo.dateLabel,
  stage: photo.stage,
  score: photo.score,
}))

/**
 * Formats a scan's ISO timestamp into the short chip label ("May 13"). Empty on
 * an unparseable value so the caller can hide the chip.
 */
export function formatScanDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

/** Recommended cadence between scans, in days — the basis of the next-scan due date. */
const RECOMMENDED_INTERVAL_DAYS = 14

/**
 * The "Next scan" banner text, computed from the latest scan instead of a
 * hardcoded "6 May". The due date is that scan's capture plus the recommended
 * interval; the label states the cadence.
 *
 * Purely a function of `capturedAtIso` — no `Date.now()`, no locale-local "today"
 * — so it is deterministic and renders identically on the server and client (no
 * hydration mismatch, and it satisfies the render-purity rule). A precise live
 * "in N days" countdown was dropped on purpose: it would need a ticking clock in
 * render, which this screen does not warrant.
 */
export function nextScanBanner(capturedAtIso: string): { inLabel: string; date: string } {
  const captured = new Date(capturedAtIso)
  if (Number.isNaN(captured.getTime())) return { inLabel: 'Recommended', date: '' }

  const due = new Date(captured.getTime() + RECOMMENDED_INTERVAL_DAYS * 86_400_000)
  const date = due.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
  return { inLabel: 'in 2 weeks', date }
}

/**
 * The image(s) the COMPARE screen shows, given all of a user's scans (oldest
 * first). Each scan's `image` is its first captured shot (the cover).
 *
 *   - 0 scans → [] (the caller shows the blank placeholder);
 *   - 1 scan  → [that scan] (single view);
 *   - 2 scans → [first, second];
 *   - 3+ scans→ [first-ever, latest] — a longer history still compares the very
 *               first scan against the newest, NOT the last two.
 */
export function comparePair(scans: DisplayScan[]): DisplayScan[] {
  if (scans.length === 0) return []
  if (scans.length === 1) return [scans[0]!]
  return [scans[0]!, scans[scans.length - 1]!]
}

/** The single reference image AI-insight shows — always the latest scan. */
export function latestScan(scans: DisplayScan[]): DisplayScan | null {
  return scans.length ? scans[scans.length - 1]! : null
}
