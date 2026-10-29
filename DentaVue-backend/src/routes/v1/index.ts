import { Router } from 'express'
import authRoutes from './auth.routes.js'
import profileRoutes from './profile.routes.js'
import scanRoutes from './scan.routes.js'

/**
 * Mounts every v1 module. Add new route files here.
 *
 * The API spec covers auth, profile, appointments, and availability (#1–37)
 * and then stops. Payments, notifications, reviews, search, messaging, guided
 * scan, clinic, and onboarding have no endpoints specified — those need
 * designing, not transcribing. See CLAUDE.md.
 */
const router = Router()

router.use('/auth', authRoutes)
router.use('/profile', profileRoutes)
router.use('/scans', scanRoutes)

// TODO: provider, appointments, availability, clinics, services,
// payments, notifications, reviews, search, messages

export default router
