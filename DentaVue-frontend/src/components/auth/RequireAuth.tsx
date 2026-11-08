'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useSessionQuery } from '@/features/auth/authApi'
import { useAppSelector } from '@/store/hooks'
import { selectIsAuthenticated } from '@/features/auth/authSlice'
import { ROUTES } from '@/constants/routes'
import LoaderIcon from '@/icons/loader.svg'

/**
 * Gates a route on being signed in — wrap the protected pages (the guided-scan
 * flow, AI-insight, Compare) so a signed-out visitor is sent to sign-in instead
 * of reaching them.
 *
 * Auth lives in memory, so a reload starts signed-out until the session is
 * restored from the httpOnly refresh cookie (POST /auth/session — see providers'
 * SessionLoader). This guard WAITS for that restore to settle before deciding, so
 * it never bounces a real signed-in user mid-refresh: while the restore is in
 * flight it shows a loader, and only once it has resolved and the user is still
 * not authenticated does it redirect. `useSessionQuery()` shares the one restore
 * request the SessionLoader already fired (RTK Query dedupes it).
 *
 * Client-side on purpose: the restore is a same-site fetch that carries the
 * cookie in dev and prod, unlike a Next middleware trying to read the API's
 * cookie cross-origin. The guarded pages hold only placeholder content, so no
 * data leaks in the brief moment before a redirect.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter()
  const isAuthenticated = useAppSelector(selectIsAuthenticated)
  const { isUninitialized, isLoading, isFetching } = useSessionQuery()
  const restoring = isUninitialized || isLoading || isFetching

  useEffect(() => {
    if (!restoring && !isAuthenticated) {
      router.replace(ROUTES.auth.signin)
    }
  }, [restoring, isAuthenticated, router])

  if (isAuthenticated) return <>{children}</>

  // Restoring, or settled-and-signed-out (redirecting) — a neutral loader.
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex min-h-dvh items-center justify-center bg-background"
    >
      <LoaderIcon
        aria-hidden="true"
        className="size-8 animate-spin text-foreground-secondary motion-reduce:animate-none"
      />
      <span className="sr-only">Loading…</span>
    </div>
  )
}
