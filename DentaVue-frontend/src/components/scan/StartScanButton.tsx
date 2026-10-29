'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { ROUTES } from '@/constants/routes'
import CameraIcon from '@/icons/camera.svg'

/**
 * "Scan Now" entry point — opens the guided-scan prep flow rather than the camera
 * directly (the flow's own CTA opens the camera; see ScanNowButton). This is what
 * the home hero card, the bottom-nav scan tile, and the compare CTA use, so a
 * scan always starts with the framing guidance.
 *
 * The design draws this as a solid fill with a white label + icon; `variant` and
 * `label` are props so each surface keeps its own treatment (blue on compare,
 * teal on the home card) while sharing one action.
 */
export function StartScanButton({
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
      onClick={() => router.push(ROUTES.patient.guidedScan)}
    >
      {label}
    </Button>
  )
}
