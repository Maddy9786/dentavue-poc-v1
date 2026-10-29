import type { UserType } from '@/types/api'

/**
 * Step 1 of onboarding: which persona is signing up.
 *
 * This is the first of the Figma's multi-step post-signup flow, so it is shaped
 * as data rather than hard-coded markup — the screen maps over this list, and
 * later steps can follow the same pattern. The chosen `userType` is what a
 * profile-update call will eventually send (the endpoint isn't specified yet —
 * see the spec-coverage gap in CLAUDE.md); until then the choice lives in local
 * state.
 *
 * `id` doubles as the icon key (see the onboarding page's icon map) and the
 * radio value.
 */
export interface PersonaOption {
  id: 'patient' | 'provider'
  userType: UserType
  title: string
  description: string
}

export const personaOptions: PersonaOption[] = [
  {
    id: 'patient',
    userType: 'patient',
    title: 'For my oral health',
    description:
      'Scan my smile, monitor my oral health, and connect with trusted dental professionals.',
  },
  {
    id: 'provider',
    userType: 'provider',
    title: 'I am a dentist',
    description: 'Review AI scan reports, manage appointments, and provide personalized care.',
  },
]
