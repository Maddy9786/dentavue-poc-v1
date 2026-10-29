'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import CameraIcon from '@/icons/camera.svg'

/**
 * "Scan Now" — the prep screen's CTA. It advances the guided-scan flow to the
 * photo-capture screen (front teeth → upper gums → tongue → lower gums), which is
 * where the camera actually opens. The scan *entry* points (home hero card,
 * bottom-nav scan tile, compare) use StartScanButton, which opens the prep screen
 * first, so a scan always runs prep → capture.
 *
 * The design draws this as the primary blue fill with a white label + icon; the
 * `variant`/label are props so a caller can override.
 */
export function ScanNowButton({
  label = 'Scan Now',
  variant = 'primary',
}: {
  label?: string
  variant?: 'primary' | 'secondary'
}) {
  const router = useRouter()

  return (
    // White label/icon per the client's blue/white combination (below AA on the
    // fill; kept per client instruction, pending confirmation).
    <Button
      variant={variant}
      className="text-surface"
      icon={<CameraIcon aria-hidden="true" className="size-5 text-surface" />}
      onClick={() => router.push(ROUTES.patient.photoCapture)}
    >
      {label}
    </Button>
  )
}
