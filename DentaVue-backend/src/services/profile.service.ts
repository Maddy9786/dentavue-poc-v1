import * as profileModel from '@/models/profile.model.js'
import type { Profile } from '@/models/profile.model.js'
import type { UpdateProfileInput } from '@/validators/profile.validator.js'

/**
 * Profile business logic — the app's own data about a person (identity stays in
 * Supabase's auth.users; see profile.model).
 *
 * Services compose models and hold the rules; controllers call services, never
 * models directly.
 */

/**
 * Applies onboarding step 3 to the caller's profile.
 *
 * The screen has a single "Full name" field but profiles stores first/last, so
 * the name is split here: first token → first_name, the remainder → last_name.
 * A single-word name lands entirely in first_name with an empty last_name, which
 * matches how sign-up leaves them.
 */
export async function updateOnboardingProfile(
  userId: string,
  input: UpdateProfileInput,
): Promise<Profile> {
  const [firstName, ...rest] = input.fullName.trim().split(/\s+/)

  return profileModel.update(userId, {
    firstName: firstName ?? '',
    lastName: rest.join(' '),
    age: input.age,
    gender: input.gender,
    healthConditions: input.healthConditions,
    oralGoals: input.oralGoals,
  })
}
