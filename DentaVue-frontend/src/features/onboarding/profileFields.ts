/**
 * Onboarding — step 3 ("Create your profile") field definitions.
 *
 * Kept as data so the screen maps over each group and the eventual
 * profile-update payload can be assembled from these ids (the endpoint isn't
 * specified yet — see CLAUDE.md's coverage gap). `conditions` ids double as icon
 * keys (see the screen's icon map).
 */

export const genderOptions = [
  { value: 'male', label: 'Male' },
  { value: 'female', label: 'Female' },
  { value: 'other', label: 'Other' },
] as const

export type Gender = (typeof genderOptions)[number]['value']

export interface HealthCondition {
  id: 'smoking' | 'pregnancy' | 'diabetes' | 'penicillin-allergy'
  label: string
}

export const healthConditions: HealthCondition[] = [
  { id: 'smoking', label: 'Smoking' },
  { id: 'pregnancy', label: 'Pregnancy' },
  { id: 'diabetes', label: 'Diabetes' },
  { id: 'penicillin-allergy', label: 'Penicillin allergy' },
]

export interface OralGoal {
  id: string
  label: string
}

export const oralGoals: OralGoal[] = [
  { id: 'healthier-gums', label: 'Healthier gums' },
  { id: 'whiter-teeth', label: 'Whiter teeth' },
  { id: 'fresh-breath', label: 'Fresh breath' },
  { id: 'prevent-decay', label: 'Prevent decay' },
  { id: 'reduce-sensitivity', label: 'Reduce sensitivity' },
]
