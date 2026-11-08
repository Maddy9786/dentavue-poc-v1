'use client'

import { useState, type ReactNode } from 'react'
import { Provider } from 'react-redux'
import { makeStore } from '@/store'
import { useSessionQuery } from '@/features/auth/authApi'
import { OfflineOverlay } from '@/components/feedback/OfflineOverlay'

/**
 * Creates the store once per client mount (and once per server render) and
 * hands it to react-redux. Kept separate from layout.tsx so the root layout
 * stays a server component.
 *
 * useState's lazy initialiser — not useRef. The ref version reads
 * `ref.current` during render, which React 19 forbids (react-hooks/refs).
 * Passing a function means makeStore runs once on mount, not on every render.
 */
export function Providers({ children }: { children: ReactNode }) {
  const [store] = useState(makeStore)

  return (
    <Provider store={store}>
      <SessionLoader />
      {children}
      {/* Global: shows a blocking offline screen whenever the browser loses its
          connection, on any route. Renders nothing while online. */}
      <OfflineOverlay />
    </Provider>
  )
}

/**
 * Restores the session on load: fires POST /auth/session once (its
 * onQueryStarted stores the result on success, or stays signed out on a 401).
 * Renders nothing — it exists only to run the query inside the Provider.
 */
function SessionLoader() {
  useSessionQuery()
  return null
}
