import type { ReactNode } from 'react'
import { RequireAuth } from '@/components/auth/RequireAuth'

/** Protects the AI-insight write-up — sign-in required. */
export default function AiInsightLayout({ children }: { children: ReactNode }) {
  return <RequireAuth>{children}</RequireAuth>
}
