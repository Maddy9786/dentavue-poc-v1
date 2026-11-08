import type { Request, Response } from 'express'
import * as profileService from '@/services/profile.service.js'
import { sendSuccess } from '@/views/response.js'
import { ApiError } from '@/utils/ApiError.js'
import type { UpdateProfileInput } from '@/validators/profile.validator.js'

/**
 * Profile controller — thin HTTP glue. Input is already validated by middleware
 * and the caller is already authenticated (see the route); Express 5 forwards
 * rejected promises to errorHandler, so no try/catch here.
 */

/**
 * PATCH /profile — the caller updates their own profile (onboarding step 3).
 * The id comes from the verified token, never the body, so one user can't write
 * another's row.
 */
export async function updateProfile(req: Request, res: Response): Promise<Response> {
  if (!req.user) throw ApiError.unauthorized()
  const profile = await profileService.updateOnboardingProfile(
    req.user.userId,
    req.body as UpdateProfileInput,
  )
  return sendSuccess(res, 'Profile updated successfully', profile)
}
