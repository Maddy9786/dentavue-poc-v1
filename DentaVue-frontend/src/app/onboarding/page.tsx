'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { Modal } from '@/components/ui/Modal'
import { PersonaOption } from '@/components/onboarding/PersonaOption'
import { personaOptions, type PersonaOption as PersonaOptionData } from '@/features/onboarding/personaOptions'
import { ROUTES } from '@/constants/routes'
import PatientIcon from '@/icons/patient.svg'
import DentistIcon from '@/icons/dentist.svg'

/**
 * Onboarding — step 1: "How will you use DentaVue?"
 *
 * Reached right after Create Account. It's a single-select persona chooser
 * (patient vs. dentist), rendered as a radio group so it is keyboard- and
 * screen-reader-navigable. The question is the page's <h1> and labels the group
 * (aria-labelledby), so assistive tech announces "How will you use DentaVue?,
 * group" and each option by its own text. The first option is preselected, so
 * Finish always has a value.
 *
 * Top-aligned (not centred like auth): the design pins the content near the top
 * with the tall screen empty below, and the column caps at the 375px mobile
 * frame width and centres on wider viewports.
 *
 * Icons are wired here rather than in the data, keyed by option id. They are
 * self-contained chips (each SVG has its own dark square + white glyph), so the
 * card renders them directly.
 */
const ICONS = {
  patient: PatientIcon,
  provider: DentistIcon,
} as const

export default function OnboardingPage() {
  const router = useRouter()
  const [selectedId, setSelectedId] = useState<PersonaOptionData['id']>(
    personaOptions[0]?.id ?? 'patient',
  )
  const [providerNotice, setProviderNotice] = useState(false)

  const handleContinue = () => {
    // Only the patient (scan) journey is built. Choosing "I am a dentist" and
    // continuing shows a coming-soon notice instead of advancing — the provider
    // flow isn't available yet.
    if (selectedId !== 'patient') {
      setProviderNotice(true)
      return
    }
    router.push(ROUTES.onboarding.intro)
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      {/* Top-aligned, but with real breathing room above: near the top on
          mobile (the design's ~68px), lower on taller/desktop viewports. */}
      <main className="mx-auto flex w-full max-w-[375px] flex-1 flex-col px-lg pt-16 pb-lg md:pt-[15vh]">
        <p className="text-body font-semibold tracking-wide text-foreground-secondary uppercase">
          Get started
        </p>

        <div className="mt-2xl flex flex-col">
          <h1 id="onboarding-question" className="text-h1-xl leading-8 text-foreground">
            How will you use DentaVue?
          </h1>

          <div
            role="radiogroup"
            aria-labelledby="onboarding-question"
            className="mt-sm flex flex-col gap-md"
          >
            {personaOptions.map((option) => (
              <PersonaOption
                key={option.id}
                option={option}
                icon={ICONS[option.id]}
                name="persona"
                defaultChecked={option.id === selectedId}
                onSelect={(o) => setSelectedId(o.id)}
              />
            ))}
          </div>
        </div>

        {/* White label per the client's request (below AA on the fill; kept per
            client instruction, pending confirmation). */}
        <Button variant="secondary" className="mt-2xl text-surface" onClick={handleContinue}>
          Continue
        </Button>
      </main>

      <Modal
        open={providerNotice}
        onClose={() => setProviderNotice(false)}
        title="Coming soon"
      >
        <div className="flex flex-col gap-lg">
          <p className="text-h2 text-foreground-secondary">
            The dentist experience is on the way. For now, DentaVue is available for patients —
            choose &ldquo;For my oral health&rdquo; to continue.
          </p>
          <Button variant="primary" className="text-surface" onClick={() => setProviderNotice(false)}>
            Got it
          </Button>
        </div>
      </Modal>
    </div>
  )
}
