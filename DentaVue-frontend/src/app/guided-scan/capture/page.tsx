import type { Metadata } from 'next'
import { PhotoCaptureFlow } from '@/components/scan/PhotoCaptureFlow'

export const metadata: Metadata = {
  title: 'Guided Scan · Capture',
}

/**
 * Photo-capture screen — the second step of the guided-scan flow, reached from
 * the prep screen's "Scan Now". It walks the user through four framed shots
 * (front teeth → upper gums → tongue → lower gums) with a live camera.
 *
 * The whole screen is stateful (the current step drives the progress bar, the
 * step chip, and the capture), so it is one client island; the server component
 * only carries the route metadata. Not route-protected — same reasoning as the
 * rest of the app (auth is in memory; a guard would bounce a real user on
 * refresh). Framed as wellness capture, not diagnosis.
 */
export default function PhotoCapturePage() {
  return <PhotoCaptureFlow />
}
