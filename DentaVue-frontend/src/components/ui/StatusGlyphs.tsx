import type { ReactNode } from 'react'

/**
 * Small inline status/utility glyphs shared across screens (AI-insight actions,
 * the compare checklist, the scan-frame placeholder). Kept here rather than in
 * src/icons because they aren't Figma exports and are one-off marks; all draw
 * with currentColor so the surrounding text colour tints them.
 *
 * Each is decorative on its own — callers put them inside an aria-hidden chip or
 * pair them with a visible label, so the glyphs carry no accessible name.
 */
function Glyph({
  children,
  size = 'size-4',
  strokeWidth = 2,
}: {
  children: ReactNode
  size?: string
  strokeWidth?: number
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      className={size}
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  )
}

export function CheckGlyph() {
  return (
    <Glyph>
      <path d="M20 6 9 17l-5-5" />
    </Glyph>
  )
}

/** Circle with a check — a completed step on the analysing screen. */
export function CheckCircleGlyph() {
  return (
    <Glyph size="size-5" strokeWidth={1.8}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 4.5-5.5" />
    </Glyph>
  )
}

export function AlertCircleGlyph() {
  return (
    <Glyph>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v4.5M12 16h.01" />
    </Glyph>
  )
}

export function AlertTriangleGlyph({ size = 'size-5' }: { size?: string } = {}) {
  return (
    <Glyph size={size} strokeWidth={1.7}>
      <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </Glyph>
  )
}

/** Magnifier — the "we looked but couldn't find it" mark on the 404 screen. */
export function SearchGlyph({ size = 'size-9' }: { size?: string } = {}) {
  return (
    <Glyph size={size} strokeWidth={1.8}>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.35-4.35" />
    </Glyph>
  )
}

/** Wi-Fi arcs struck through — the offline screen's mark. */
export function WifiOffGlyph({ size = 'size-9' }: { size?: string } = {}) {
  return (
    <Glyph size={size} strokeWidth={1.8}>
      <path d="M2 8.82a15 15 0 0 1 20 0" />
      <path d="M5 12.86a10 10 0 0 1 14 0" />
      <path d="M8.5 16.43a5 5 0 0 1 7 0" />
      <path d="M12 20h.01" />
      <path d="M2 2l20 20" />
    </Glyph>
  )
}

/** Upward trend line — the "comparison unlocks" chip. */
export function TrendUpGlyph() {
  return (
    <Glyph size="size-5" strokeWidth={1.8}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M17 7h4v4" />
    </Glyph>
  )
}

/** Corner-bracket scan frame — the empty "Next Scan" placeholder tile. */
export function ScanFrameGlyph() {
  return (
    <Glyph size="size-8" strokeWidth={1.7}>
      <path d="M4 8V6a2 2 0 0 1 2-2h2" />
      <path d="M16 4h2a2 2 0 0 1 2 2v2" />
      <path d="M20 16v2a2 2 0 0 1-2 2h-2" />
      <path d="M8 20H6a2 2 0 0 1-2-2v-2" />
    </Glyph>
  )
}

/** Smiley — the positive "nice progress" note on the two-scan compare. */
export function SmileGlyph() {
  return (
    <Glyph size="size-6" strokeWidth={1.7}>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 14.5a4.5 4.5 0 0 0 7 0" />
      <path d="M9 9.5h.01M15 9.5h.01" />
    </Glyph>
  )
}

/** Short down arrow — the "↓ N Points" change indicator. */
export function ArrowDownGlyph() {
  return (
    <Glyph size="size-3.5" strokeWidth={2.4}>
      <path d="M12 5v14M6 13l6 6 6-6" />
    </Glyph>
  )
}
