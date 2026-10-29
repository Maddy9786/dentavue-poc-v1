import type { NextFunction, Request, Response } from 'express'
import { supabaseAdmin } from '@/config/supabase.js'
import { ApiError } from '@/utils/ApiError.js'
import * as profileModel from '@/models/profile.model.js'
import type { UserType } from '@/types/domain.js'

/**
 * Verifies the bearer token with Supabase and populates req.user.
 *
 * The token is a Supabase JWT, so it is verified by asking Supabase — which
 * checks the signature AND that the session has not been revoked. Verifying the
 * signature locally would be faster but would happily accept a token from a user
 * who signed out or was deleted, until it expired on its own.
 *
 * Persona comes from `profiles`, not from the JWT's user_metadata: metadata is
 * writable by the user in some Supabase configurations, and a self-assigned
 * `userType: "provider"` would walk straight through requireUserType().
 */
export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const header = req.headers.authorization

  if (!header?.startsWith('Bearer ')) {
    throw ApiError.unauthorized('Missing or malformed Authorization header')
  }

  const token = header.slice('Bearer '.length)
  const { data, error } = await supabaseAdmin.auth.getUser(token)

  if (error || !data.user) {
    throw ApiError.unauthorized('Invalid or expired access token')
  }

  const profile = await profileModel.findById(data.user.id)
  if (!profile) {
    throw ApiError.forbidden('Your account is not fully set up')
  }

  req.user = {
    userId: profile.userId,
    userType: profile.userType,
    email: data.user.email ?? '',
  }
  req.accessToken = token

  next()
}

/**
 * Restricts a route to one persona. Mount after `authenticate`.
 *
 * This is a coarse gate — it proves the caller is a provider, not that they own
 * the clinic or slot they are addressing. Ownership belongs in the service
 * layer, since the service-role Supabase client bypasses RLS and will not catch
 * it.
 */
export function requireUserType(...allowed: UserType[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) throw ApiError.unauthorized()
    if (!allowed.includes(req.user.userType)) {
      throw ApiError.forbidden(`This endpoint requires: ${allowed.join(' or ')}`)
    }
    next()
  }
}
