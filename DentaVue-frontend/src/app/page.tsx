import type { Metadata } from 'next'
import { GreetingHeader } from '@/components/dashboard/GreetingHeader'
import { OralHealthCard } from '@/components/dashboard/OralHealthCard'
import { GlanceSection } from '@/components/dashboard/GlanceSection'
import { LatestFindings } from '@/components/dashboard/LatestFindings'
import { CompareProgress } from '@/components/dashboard/CompareProgress'
import { RecommendedDentists } from '@/components/dashboard/RecommendedDentists'
import { ComingSoon } from '@/components/dashboard/ComingSoon'
import { BottomNav } from '@/components/layout/BottomNav'

export const metadata: Metadata = {
  // Spelled out rather than left to layout.tsx's `%s | DentaVue` template:
  // Next applies that template to CHILD segments only, and this page shares a
  // segment with the root layout, so `title: 'Home'` alone renders a bare
  // "Home" — the one screen in the app whose tab carries no brand.
  title: 'Home | DentaVue',
}

/**
 * Patient home ("Home Blue") — the app's landing at `/`. The dashboard IS the
 * home page, so it lives here rather than at a separate /dashboard route.
 *
 * A server component: the greeting and bottom nav are the only interactive
 * islands (both 'use client'), so everything else renders on the server. The
 * content is a mobile-first centred column — the design's 375px frame is the
 * base — that widens modestly on desktop rather than stretching edge to edge,
 * matching the auth screens' treatment. `pb-32` clears the fixed bottom nav.
 *
 * Not route-protected (auth state is in memory): a signed-out visitor sees the
 * placeholder/mock content (see mockDashboard.ts) with sign-in prompts; the
 * bottom nav's account tab handles sign-in / sign-up. Onboarding's Finish/Skip
 * and every post-auth redirect land here.
 */
export default function HomePage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex w-full app-column flex-col gap-2xl px-lg pt-2xl pb-32">
        <GreetingHeader />
        <OralHealthCard />
        <GlanceSection />
        <LatestFindings />
        <CompareProgress />
        <RecommendedDentists />
        <ComingSoon />
      </div>
      <BottomNav />
    </div>
  )
}
