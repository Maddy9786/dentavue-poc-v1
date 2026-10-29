import type { ReactNode } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'

/**
 * Protects the whole guided-scan flow (prep, capture, analysing, risk assessment,
 * results) — a signed-out visitor is redirected to sign-in. Server layout; the
 * gating itself is the RequireAuth client island.
 */
export default function GuidedScanLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
