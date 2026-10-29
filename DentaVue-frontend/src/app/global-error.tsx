'use client'

import { useEffect } from 'react'
import { appFont } from '@/lib/fonts'
import { Button } from '@/components/ui/Button'
import { StatusScreen } from '@/components/feedback/StatusScreen'
import { AlertTriangleGlyph } from '@/components/ui/StatusGlyphs'
import './globals.css'

/**
 * Root error boundary — the last resort, rendered only when the ROOT layout
 * itself throws. It REPLACES the layout, so it must bring its own <html>/<body>
 * and re-import the global stylesheet (nothing above it runs), and it applies the
 * font variable exactly as layout.tsx does so the tokens that reference
 * --font-app resolve.
 *
 * Recovery avoids the router (the tree that owns it just failed): "Try again" is
 * Next's `reset`, and "Go to home" is a hard `location` navigation, which is the
 * dependable way out of a broken root.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en" className={appFont.variable}>
      <body>
        <StatusScreen
          tone="error"
          icon={<AlertTriangleGlyph size="size-9" />}
          title="Something went wrong"
          description="The app ran into an unexpected problem. Reloading usually clears it."
          footnote={error.digest ? `Reference: ${error.digest}` : undefined}
          actions={
            <>
              <Button variant="primary" onClick={() => reset()}>
                Try again
              </Button>
              <Button
                variant="surface"
                className="border border-border text-foreground-secondary shadow-none"
                onClick={() => {
                  window.location.href = '/'
                }}
              >
                Go to home
              </Button>
            </>
          }
        />
      </body>
    </html>
  )
}
