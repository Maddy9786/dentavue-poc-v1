'use client'

import { useCallback, useState, useSyncExternalStore } from 'react'
import { Button } from '@/components/ui/Button'
import { StatusContent } from '@/components/feedback/StatusScreen'
import { WifiOffGlyph } from '@/components/ui/StatusGlyphs'
import LoaderIcon from '@/icons/loader.svg'

/**
 * Full-screen offline notice — DentaVue talks only to its API, so with no
 * connection nothing works, and a blocking screen is more honest than letting
 * every action fail silently.
 *
 * Connection state comes from useSyncExternalStore over the browser's own
 * `online`/`offline` events (the sanctioned way to read external state — no
 * setState-in-effect, and the server snapshot is "online" so it never renders
 * during SSR or trips hydration). When the browser reconnects it fires `online`,
 * the snapshot flips, and this unmounts itself — recovery is automatic.
 *
 * "Try again" additionally PROBES the network (a no-store HEAD to our own
 * origin), for the case the browser is unsure — a captive portal, a flaky link.
 *
 * Accessibility: it is an `alertdialog` (labelled + described by the real title
 * and copy), focus moves into it on show, and the live-status line is announced
 * politely as it changes. Honours prefers-reduced-motion on the spinner.
 */

function subscribe(callback: () => void) {
  window.addEventListener('online', callback)
  window.addEventListener('offline', callback)
  return () => {
    window.removeEventListener('online', callback)
    window.removeEventListener('offline', callback)
  }
}
const getOnline = () => navigator.onLine
const getOnlineOnServer = () => true

export function OfflineOverlay() {
  const online = useSyncExternalStore(subscribe, getOnline, getOnlineOnServer)
  const [checking, setChecking] = useState(false)

  // Move focus into the dialog when it appears. A ref callback fires on mount
  // (and only when offline, since the element is not rendered otherwise), so no
  // effect is needed; focusing is a DOM side effect, not React state.
  const focusOnShow = useCallback((node: HTMLDivElement | null) => {
    node?.focus()
  }, [])

  const recheck = useCallback(async () => {
    setChecking(true)
    try {
      // A reachable origin means we have connectivity; the browser will also fire
      // `online`, which unmounts this. no-store so nothing is served from cache.
      await fetch('/', { method: 'HEAD', cache: 'no-store' })
    } catch {
      // Still offline — the overlay stays; nothing else to do.
    } finally {
      setChecking(false)
    }
  }, [])

  if (online) return null

  return (
    <div
      ref={focusOnShow}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="offline-title"
      aria-describedby="offline-desc"
      tabIndex={-1}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3xl bg-background px-lg py-2xl outline-none"
    >
      <StatusContent
        tone="neutral"
        icon={<WifiOffGlyph />}
        title="You’re offline"
        description="DentaVue needs a connection to work. We’ll reconnect automatically as soon as you’re back online."
        headingId="offline-title"
        descId="offline-desc"
        actions={
          <>
            <p
              aria-live="polite"
              className="flex items-center justify-center gap-sm text-body text-foreground-secondary"
            >
              <LoaderIcon
                aria-hidden="true"
                className="size-4 animate-spin motion-reduce:animate-none"
              />
              {checking ? 'Checking for a connection…' : 'Waiting for a connection…'}
            </p>
            <Button variant="primary" onClick={() => void recheck()} disabled={checking}>
              Try again
            </Button>
          </>
        }
      />
    </div>
  )
}
