'use client'

import { useRouter } from 'next/navigation'
import { WelcomeScreen } from '@/components/onboarding/WelcomeScreen'
import { ROUTES } from '@/constants/routes'

/**
 * Onboarding step 1 — the welcome splash shown right after Create Account. Here
 * "Get Started" advances into the persona chooser (step 2). Same visual as the
 * app landing (`/`); only the primary action differs.
 */
export default function OnboardingWelcomePage() {
  const router = useRouter()
  return <WelcomeScreen onGetStarted={() => router.push(ROUTES.onboarding.personas)} />
}
