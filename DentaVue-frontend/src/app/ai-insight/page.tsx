import type { Metadata } from 'next'
import { BackButton } from '@/components/ui/BackButton'
import { AiInsightContent } from '@/components/insight/AiInsightContent'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'AI Insight',
}

/**
 * The full AI-insight write-up, reached from "See full analysis" on Home (a
 * signed-in user only — the Home button routes here; a signed-out tap gets the
 * sign-in nudge instead).
 *
 * A thin server shell: it owns the metadata and the header, and defers the body
 * to AiInsightContent, a client island that reads the real analysis (pass 2's
 * prose) and falls back to placeholder copy when there isn't one. Route-protected
 * by this segment's layout.
 *
 * Layout mirrors Home: the 375px mobile frame as the base, widening modestly on
 * desktop. The copy is wellness framing, not a diagnosis, per the project scope.
 */
export default function AiInsightPage() {
  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full app-column flex-col gap-2xl px-lg pt-2xl pb-2xl">
        {/* Back arrow pinned left, title centred on the screen (not in the space
            beside the arrow) so it stays visually centred. */}
        <header className="relative flex h-9 items-center justify-center">
          <div className="absolute left-0">
            <BackButton fallbackHref={ROUTES.home} />
          </div>
          <h1 className="text-h1 font-semibold text-foreground">AI insight</h1>
        </header>

        <AiInsightContent />
      </div>
    </main>
  )
}
