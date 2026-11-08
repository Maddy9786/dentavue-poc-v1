'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/Button'
import { TextField } from '@/components/ui/TextField'
import { SegmentedControl } from '@/components/ui/SegmentedControl'
import { AgeStepper } from '@/components/onboarding/AgeStepper'
import { ConditionToggle } from '@/components/onboarding/ConditionToggle'
import { GoalChip } from '@/components/onboarding/GoalChip'
import {
  genderOptions,
  healthConditions,
  oralGoals,
  type Gender,
  type HealthCondition,
} from '@/features/onboarding/profileFields'
import { useUpdateProfileMutation } from '@/features/profile/profileApi'
import { getApiErrorMessage } from '@/lib/apiError'
import { ROUTES } from '@/constants/routes'
import SmokeIcon from '@/icons/smoke.svg'
import PregnancyIcon from '@/icons/pregnancy.svg'
import DiabetesIcon from '@/icons/diabetes.svg'
import PenicillinAllergyIcon from '@/icons/pencillin-allergy.svg'

/**
 * Onboarding — step 3: "Create your profile".
 *
 * The final carousel step (step 2 of 2 in the indicator). A form of three
 * grouped sections — personal information, health conditions, oral goals — each
 * built from the field data so the eventual profile-update payload can be
 * assembled from the same ids (endpoint not specified yet — see CLAUDE.md).
 *
 * Accessibility: real form controls throughout — TextField (labelled input),
 * AgeStepper (number input + labelled steppers), a radio-group segmented control
 * for gender, switches for conditions, and aria-pressed chips for goals. Each
 * section is introduced by an <h2> so the screen is navigable by heading.
 *
 * Finish saves the profile to Supabase (PATCH /profile) and then lands on the
 * dashboard; the call is authenticated because sign-up now issues a session.
 * Skip goes straight to the dashboard without saving.
 */
const CONDITION_ICONS = {
  smoking: SmokeIcon,
  pregnancy: PregnancyIcon,
  diabetes: DiabetesIcon,
  'penicillin-allergy': PenicillinAllergyIcon,
} as const

export default function OnboardingProfilePage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [age, setAge] = useState(23)
  const [gender, setGender] = useState<Gender>('female')
  const [conditions, setConditions] = useState<Record<HealthCondition['id'], boolean>>({
    smoking: true,
    pregnancy: false,
    diabetes: false,
    'penicillin-allergy': false,
  })
  const [goals, setGoals] = useState<string[]>(['healthier-gums', 'whiter-teeth'])
  const [updateProfile, { isLoading, error }] = useUpdateProfileMutation()
  const [nameError, setNameError] = useState<string | undefined>(undefined)

  const toggleGoal = (id: string) =>
    setGoals((current) =>
      current.includes(id) ? current.filter((g) => g !== id) : [...current, id],
    )

  const handleFinish = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    if (!fullName.trim()) {
      setNameError('Enter your name')
      return
    }
    setNameError(undefined)

    try {
      await updateProfile({
        fullName: fullName.trim(),
        age,
        gender,
        // Record<id, boolean> → the list of active condition ids the API expects.
        healthConditions: healthConditions.filter((c) => conditions[c.id]).map((c) => c.id),
        oralGoals: goals,
      }).unwrap()
      router.push(ROUTES.patient.dashboard)
    } catch {
      // A failed save keeps the user on the screen; rendered from `error` below.
    }
  }

  return (
    <div className="flex min-h-dvh flex-col bg-background">
      <main className="mx-auto flex w-full max-w-[375px] flex-1 flex-col px-lg pt-6 pb-lg">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2xs" aria-hidden="true">
            <span className="size-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-6 rounded-full bg-primary" />
          </span>
          <span className="sr-only">Step 2 of 2</span>

          <button
            type="button"
            onClick={() => router.push(ROUTES.patient.dashboard)}
            className="rounded-1 text-h2 text-foreground-secondary focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
          >
            Skip
          </button>
        </div>

        <div className="mt-2xl flex flex-col gap-2xs">
          <h1 className="text-h1-lg font-semibold text-foreground">Create your profile</h1>
          <p className="text-h2 text-foreground-secondary">
            This helps DentaVue personalise your risk model
          </p>
        </div>

        <form onSubmit={handleFinish} className="mt-2xl flex flex-col gap-2xl">
          <section className="flex flex-col gap-md">
            <h2 className="text-h2 font-medium text-secondary">Personal information</h2>

            <TextField
              label="Full name"
              showLabel
              autoComplete="name"
              placeholder="Test test test"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              error={nameError}
            />

            <AgeStepper label="Age" value={age} onChange={setAge} />

            <div>
              <span className="mb-sm block text-h2 leading-none font-regular text-foreground">
                Gender
              </span>
              <SegmentedControl
                label="Gender"
                name="gender"
                options={genderOptions}
                value={gender}
                onChange={setGender}
              />
            </div>
          </section>

          <section className="flex flex-col gap-md">
            <h2 className="text-h2 font-medium text-secondary">Health conditions</h2>
            {healthConditions.map((condition) => (
              <ConditionToggle
                key={condition.id}
                condition={condition}
                icon={CONDITION_ICONS[condition.id]}
                checked={conditions[condition.id]}
                onChange={(checked) =>
                  setConditions((current) => ({ ...current, [condition.id]: checked }))
                }
              />
            ))}
          </section>

          <section className="flex flex-col gap-sm">
            <h2 className="text-h2 font-medium text-secondary">Oral goals</h2>
            <div className="flex flex-wrap gap-sm" role="group" aria-label="Oral goals">
              {oralGoals.map((goal) => (
                <GoalChip
                  key={goal.id}
                  label={goal.label}
                  pressed={goals.includes(goal.id)}
                  onToggle={() => toggleGoal(goal.id)}
                />
              ))}
            </div>
          </section>

          {error && (
            <p role="alert" className="text-center text-h2 text-error">
              {getApiErrorMessage(error, "Couldn't save your profile. Please try again.")}
            </p>
          )}

          {/* White label per the client's blue/white combination (below AA on
              the fill; kept per client instruction, pending confirmation). */}
          <Button type="submit" variant="primary" disabled={isLoading} className="mt-lg text-surface">
            {isLoading ? 'Saving…' : 'Finish'}
          </Button>
        </form>
      </main>
    </div>
  )
}
