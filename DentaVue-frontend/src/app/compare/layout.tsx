import type { ReactNode } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'

/** Protects the scan comparison — sign-in required. */
export default function CompareLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
