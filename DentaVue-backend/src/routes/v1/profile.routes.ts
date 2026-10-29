import { Router } from 'express'
import * as profileController from '@/controllers/profile.controller.js'
import { validate } from '@/middlewares/validate.js'
import { authenticate } from '@/middlewares/authenticate.js'
import { updateProfileSchema } from '@/validators/profile.validator.js'

/**
 * Profile routes.
 *
 * Not in the API spec (it stops before profile — see CLAUDE.md); this is a
 * designed endpoint for onboarding step 3. `authenticate` first, so the row a
 * caller writes is their own (the id comes from the verified token), then
 * validate the body.
 */
const router = Router()

router.patch(
  '/',
  authenticate,
  validate({ body: updateProfileSchema }),
  profileController.updateProfile,
)

export default router
