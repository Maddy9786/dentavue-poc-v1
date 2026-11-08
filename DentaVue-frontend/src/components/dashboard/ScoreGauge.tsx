import { Badge } from '@/components/ui/Badge'

/**
 * Circular score gauge for the Oral Health Index.
 *
 * A 270° ring (90° gap at the bottom) drawn as SVG arc PATHS — not a
 * dash-clipped circle — so the fill direction and the gap placement are exact.
 *
 * The ring reads as a progress dial:
 *   - The full 270° track is WHITE (surface), so the unfilled remainder blends
 *     into the card rather than showing a grey rail.
 *   - The coloured PROGRESS arc covers score/max of the ring (82 → 82%). It
 *     starts at the lower-right leg — teal (secondary) there, per the design —
 *     and sweeps up the right, over the top and down the left, all blue
 *     (primary). At high scores the fill nearly closes the ring; the small
 *     unfilled remainder sits on the lower-LEFT leg.
 *   - Where the fill ENDS (its left tip, meeting the white remainder) it fades
 *     out, so the left leg end looks a little dimmer rather than stopping on a
 *     hard cap.
 *   - The ring is broken quarter-wise: a `strokeDasharray` of one 90° arc length
 *     leaves a small white gap every quarter, so the coloured fill reads as a
 *     few rounded segments rather than one solid band. Fill and fade share the
 *     same dash phase (both start at the lower-right leg) so their gaps align.
 *
 * ACCESSIBILITY — the SVG is decorative (aria-hidden); the whole component is one
 * labelled `role="img"` whose label states the score, delta and condition, so a
 * screen reader gets the meaning in a sentence rather than reading arc geometry.
 * The number is also visible text for sighted users.
 */
const SIZE = 168
const STROKE = 14
const RADIUS = (SIZE - STROKE) / 2
const CENTER = SIZE / 2
const ARC_SWEEP = 270 // degrees of ring drawn (90° gap at the bottom)
const START_ANGLE = 135 // lower-right leg — where the fill begins (teal)
const FADE_DEG = 34 // length of the dimming tail at the fill's end

// Quarter-wise segmentation: a dash the length of one 90° arc, then a small gap.
// Round caps eat ~STROKE into the gap, so GAP_LEN is padded to leave a few px
// of visible white between segments.
const QUARTER_LEN = (Math.PI * RADIUS) / 2 // arc length of 90°
const GAP_LEN = 18
const DASH_ARRAY = `${QUARTER_LEN - GAP_LEN} ${GAP_LEN}`

// Point on the ring. Angle is degrees clockwise from 12 o'clock.
function point(angle: number) {
  const rad = ((angle - 90) * Math.PI) / 180
  return { x: CENTER + RADIUS * Math.cos(rad), y: CENTER + RADIUS * Math.sin(rad) }
}

// Arc path starting at `start`, sweeping `sweep` degrees counter-clockwise
// (up the right side and over the top — away from the bottom gap).
function arc(start: number, sweep: number) {
  const from = point(start)
  const to = point(start - sweep)
  const largeArc = sweep > 180 ? 1 : 0
  return `M ${from.x} ${from.y} A ${RADIUS} ${RADIUS} 0 ${largeArc} 0 ${to.x} ${to.y}`
}

export function ScoreGauge({
  score,
  max,
  condition,
  pointsFromLastScan,
}: {
  score: number
  max: number
  condition: string
  pointsFromLastScan: number
}) {
  const fraction = Math.max(0, Math.min(1, score / max))
  const fillSweep = ARC_SWEEP * fraction
  const fadeSweep = Math.min(FADE_DEG, fillSweep)
  const fillEnd = START_ANGLE - fillSweep // angle where the fill (and its fade) ends

  const start = point(START_ANGLE) // lower-right — teal end of the fill
  const tip = point(fillEnd) // left — where the fill fades into the white track
  const fadeInner = point(fillEnd + fadeSweep) // start of the dimming tail

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: SIZE, height: SIZE }}
      role="img"
      aria-label={`Oral Health Index ${score} out of ${max}, up ${pointsFromLastScan} points from last scan, ${condition}`}
    >
      <svg
        aria-hidden="true"
        width={SIZE}
        height={SIZE}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="absolute inset-0"
      >
        <defs>
          {/* Fill colour, placed in the drawing: teal at the lower-right leg
              (the fill's start), primary blue everywhere else. */}
          <linearGradient
            id="gauge-fill"
            gradientUnits="userSpaceOnUse"
            x1={start.x}
            y1={start.y}
            x2={tip.x}
            y2={tip.y}
          >
            <stop offset="0%" style={{ stopColor: 'var(--color-secondary)' }} />
            <stop offset="20%" style={{ stopColor: 'var(--color-primary)' }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-primary)' }} />
          </linearGradient>
          {/* Dimming tail — white, transparent→visible toward the tip, so the
              fill's left end fades into the white track. */}
          <linearGradient
            id="gauge-fade"
            gradientUnits="userSpaceOnUse"
            x1={fadeInner.x}
            y1={fadeInner.y}
            x2={tip.x}
            y2={tip.y}
          >
            <stop offset="0%" style={{ stopColor: 'var(--color-surface)', stopOpacity: 0 }} />
            <stop offset="100%" style={{ stopColor: 'var(--color-surface)', stopOpacity: 0.7 }} />
          </linearGradient>
        </defs>

        {/* Track — the full ring, white so the unfilled part disappears. */}
        <path
          d={arc(START_ANGLE, ARC_SWEEP)}
          fill="none"
          stroke="var(--color-surface)"
          strokeWidth={STROKE}
          strokeLinecap="round"
        />
        {/* Progress — score/max of the ring, teal→blue, broken into quarters. */}
        {fraction > 0 && (
          <path
            d={arc(START_ANGLE, fillSweep)}
            fill="none"
            stroke="url(#gauge-fill)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={DASH_ARRAY}
          />
        )}
        {/* Fade — same path and dash phase as the fill, so gaps align; the
            gauge-fade gradient localises the white dimming to the left tip. */}
        {fadeSweep > 0 && (
          <path
            d={arc(START_ANGLE, fillSweep)}
            fill="none"
            stroke="url(#gauge-fade)"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={DASH_ARRAY}
          />
        )}
      </svg>

      <div className="flex flex-col items-center gap-xs">
        <div className="flex items-baseline gap-2xs">
          <span className="text-h1-xl font-semibold text-foreground">{score}</span>
          <span className="text-body text-foreground-secondary">/{max}</span>
        </div>
        {/* text-surface (#FFFFFF) overrides the badge's AA-paired dark text as
            requested. White on this green is ~2.2:1 and fails WCAG AA — kept per
            the design; the token stays untouched. */}
        <Badge tone="success" className="text-surface">
          +{pointsFromLastScan} points
        </Badge>
        <span className="text-nav text-foreground-secondary">from last scan</span>
      </div>
    </div>
  )
}
