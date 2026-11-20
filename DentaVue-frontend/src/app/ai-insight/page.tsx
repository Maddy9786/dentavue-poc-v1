import type { Metadata } from 'next'
import { BackButton } from '@/components/ui/BackButton'
import { AiInsightContent } from '@/components/insight/AiInsightContent'
import { ROUTES } from '@/constants/routes'

export const metadata: Metadata = {
  title: 'Personal Care Guide',
}

/**
 * The full Personal Care Guide write-up, reached from "See full care guide" on Home.
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
          <h1 className="text-h1 font-semibold text-foreground">Personal care guide</h1>
        </header>

        <AiInsightContent />
      </div>
    </main>
  )
}
