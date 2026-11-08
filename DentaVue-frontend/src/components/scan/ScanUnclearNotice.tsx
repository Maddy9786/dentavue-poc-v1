'use client'

import { useRouter } from 'next/navigation'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { AlertTriangleGlyph } from '@/components/ui/StatusGlyphs'
import { ROUTES } from '@/constants/routes'

/**
 * Shown on a result screen when the analysis FAILED — almost always because the
 * photos were too poor to read (the backend rejects an unreadable capture rather
 * than inventing a score; see USABLE_CONFIDENCE_FLOOR in the backend's
 * scoring.ts). It replaces the sample content on that screen so an unusable scan
 * reads as unusable, not as a flawless 100.
 *
 * `message` is the backend's own sentence, so it stays specific to why the scan
 * failed (unreadable vs. a service error) and what to do about it. The single
 * action re-runs the whole capture — retaking is the fix, since re-analysing the
 * same unreadable photos would only fail again.
 */
export function ScanUnclearNotice({ message }: { message: string }) {
  const router = useRouter()

  return (
    <Card className="flex flex-col gap-md">
      <div className="flex items-start gap-sm">
        <span className="shrink-0 text-foreground" aria-hidden="true">
          <AlertTriangleGlyph />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2xs">
          <h2 className="text-h2 font-semibold text-foreground">We couldn’t read this scan</h2>
          <p className="text-body text-foreground-secondary">{message}</p>
        </div>
      </div>
      {/* White label per the app's blue/white button treatment. */}
      <Button
        variant="primary"
        className="text-surface"
        onClick={() => router.push(ROUTES.patient.guidedScan)}
      >
        Retake scan
      </Button>
    </Card>
  )
}
