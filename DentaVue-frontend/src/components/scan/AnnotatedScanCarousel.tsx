'use client'

import { useState } from 'react'
import { cn } from '@/lib/cn'
import { SectionHeader } from '@/components/dashboard/SectionHeader'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { selectScanDraftImages } from '@/features/scan/scanDraftSlice'
import { useGetScansQuery } from '@/features/scan/scansApi'
import { demoScans, BLANK_SCAN_IMAGE } from '@/features/scan/scanDisplay'
import { useScanAnalysis } from '@/features/scan/useScanAnalysis'
import ArrowRightIcon from '@/icons/arrow-right.svg'

/**
 * "Annotated scan" — a carousel of the latest scan's uploaded images (front teeth
 * → lower gums), one at a time with a Next button, with the AI's findings drawn
 * over them.
 *
 * The images are the REAL captured images. It prefers this session's just-taken
 * shots (the scan draft), so they show straight after the flow whether or not the
 * user is signed in / the upload has landed; on a later visit (draft gone) it
 * falls back to the latest scan from GET /scans, then the demo images (signed
 * out) or the blank placeholder.
 *
 * THE ANNOTATIONS are why Gemini was chosen over the alternatives: it returns
 * bounding boxes natively as [y_min, x_min, y_max, x_max] normalised 0-1000, so
 * a box is placed with four percentages and no layout maths. Being normalised
 * also means the same stored box is correct at any display size — a responsive
 * layout needs no re-analysis. Boxes only appear once the analysis is `ready`;
 * before that (and for the demo images) the photos render plain.
 *
 * A client island (carousel index + Redux/RTK reads); mixed sources (signed URLs
 * and data: URLs) render through a plain <img>.
 */
export function AnnotatedScanCarousel() {
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const draftImages = useAppSelector(selectScanDraftImages)
  const { data } = useGetScansQuery(undefined, { skip: !isAuthenticated })
  const { analysis } = useScanAnalysis()
  const [index, setIndex] = useState(0)

  const images: string[] = (() => {
    // This session's captured shots first — the four the user just took.
    if (draftImages.length) return draftImages
    if (!isAuthenticated) return demoScans.map((scan) => scan.image)
    const scans = data ?? []
    const latest = scans[scans.length - 1]
    // Drop any angle whose object is gone (backend sends '' — see signImageUrlSafe).
    const urls = (latest?.images ?? []).map((image) => image.imageUrl).filter(Boolean)
    if (urls.length) return urls
    if (latest?.imageUrl) return [latest.imageUrl]
    return [BLANK_SCAN_IMAGE]
  })()

  const count = images.length
  const safeIndex = index % count
  const current = images[safeIndex] ?? BLANK_SCAN_IMAGE

  // Only this frame's regions. An annotation carries the frame it belongs to, so
  // a box found on the tongue shot never lands on the front-teeth shot.
  const regions = (analysis?.annotations ?? []).filter(
    (annotation) => annotation.position === safeIndex,
  )

  return (
    <section className="flex flex-col gap-md">
      <SectionHeader title="Annotated scan" meta={`View all ${count}`} />

      <div className="relative aspect-[3/2] overflow-hidden rounded-4 bg-border">
        {/* eslint-disable-next-line @next/next/no-img-element -- a signed URL or a data: URL (fresh capture), not a static asset. */}
        <img
          src={current}
          alt={`Your scan photo ${safeIndex + 1} of ${count}`}
          className="h-full w-full object-cover"
        />

        {/*
          The AI's regions. Positioned purely as percentages of the container,
          straight from Gemini's 0-1000 normalised box — no measuring, no resize
          listener, correct at every breakpoint.

          Decorative in the accessibility tree: a screen-reader user gets the
          same information as readable text below, where it is far more useful
          than "box at 41%, 23%".
        */}
        {regions.map((region) => {
          const [yMin, xMin, yMax, xMax] = region.box
          return (
            <span
              key={`${region.parameter}-${region.box.join('-')}`}
              aria-hidden="true"
              className="absolute rounded-2 border-2 border-primary shadow-drop"
              style={{
                top: `${yMin / 10}%`,
                left: `${xMin / 10}%`,
                height: `${(yMax - yMin) / 10}%`,
                width: `${(xMax - xMin) / 10}%`,
              }}
            />
          )
        })}

        {count > 1 && (
          <button
            type="button"
            onClick={() => setIndex((i) => (i + 1) % count)}
            aria-label="Next photo"
            className="absolute top-1/2 right-md grid size-9 -translate-y-1/2 place-items-center rounded-full bg-surface shadow-drop focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            <ArrowRightIcon aria-hidden="true" className="size-5 text-foreground" />
          </button>
        )}

        {count > 1 && (
          <div className="absolute inset-x-0 bottom-md flex justify-center gap-xs" aria-hidden="true">
            {images.map((image, i) => (
              <span
                key={image}
                className={cn('size-1.5 rounded-full', i === safeIndex ? 'bg-surface' : 'bg-surface/50')}
              />
            ))}
          </div>
        )}
      </div>

      {/*
        The labels for the boxes above, as text. This is the accessible
        equivalent of the overlay AND a genuinely better read for everyone —
        "redness along gum margin" says more than an unlabelled rectangle.
      */}
      {regions.length > 0 && (
        <ul className="flex flex-col gap-2xs">
          {regions.map((region) => (
            <li
              key={`label-${region.parameter}-${region.box.join('-')}`}
              className="flex items-center gap-xs text-nav text-foreground-secondary"
            >
              <span aria-hidden="true" className="size-2 shrink-0 rounded-full bg-primary" />
              {region.label}
            </li>
          ))}
        </ul>
      )}

      <span className="sr-only" aria-live="polite">
        Photo {safeIndex + 1} of {count}
        {regions.length > 0 ? `, ${regions.length} highlighted area${regions.length > 1 ? 's' : ''}` : ''}
      </span>
    </section>
  )
}
