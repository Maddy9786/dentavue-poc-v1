import { z } from 'zod'

/**
 * Request schema for updating the caller's profile from onboarding step 3.
 *
 * No endpoint is specified for this in the API doc (the spec stops mid-way — see
 * CLAUDE.md's coverage gap), so this is a designed contract, not a transcribed
 * one. It mirrors what the "Create your profile" screen collects.
 *
 * `fullName` is one field on the screen; the service splits it into
 * first_name/last_name (which is what profiles stores). Conditions and goals are
 * bounded so a caller cannot push unbounded arrays into the row.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().trim().min(1, 'Enter your name').max(100),
  age: z.number().int().min(1).max(120),
  gender: z.enum(['male', 'female', 'other']),
  healthConditions: z
    .array(z.enum(['smoking', 'pregnancy', 'diabetes', 'penicillin-allergy']))
    .max(10)
    .default([]),
  oralGoals: z.array(z.string().trim().min(1).max(50)).max(20).default([]),
})

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
