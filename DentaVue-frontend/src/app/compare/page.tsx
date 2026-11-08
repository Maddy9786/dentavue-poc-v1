import type { Metadata } from 'next'
import { BackButton } from '@/components/ui/BackButton'
import { CompareContent } from '@/components/compare/CompareContent'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Compare',
}

/**
 * Scan comparison, reached from "View Scan" on Home's Compare Progress.
 *
 * The server shell owns the header; the view itself depends on client state
 * (auth + captured scans), so it lives in CompareContent:
 *   - signed out → the two-scan demo;
 *   - signed in, no scans → single-scan layout with the blank-image placeholder;
 *   - signed in, one scan → single-scan layout with that image;
 *   - signed in, 2+ scans → the two-scan comparison of the latest two.
 *
 * Not route-protected, and framed as wellness guidance, not diagnosis — same as
 * the rest of the app. Layout mirrors the other screens: the 375px mobile frame
 * as the base, widening modestly on desktop.
 */
export default function ComparePage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full app-column flex-col gap-2xl px-lg pt-2xl pb-2xl">
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">Compare</h1>
        </header>

        <CompareContent />
      </div>
    </main>
  )
}
