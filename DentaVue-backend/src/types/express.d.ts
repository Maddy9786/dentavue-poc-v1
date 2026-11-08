import type { UserType } from './domain.js'

declare global {
  namespace Express {
    interface Request {
      /**
       * The authenticated caller. Populated by middlewares/authenticate.ts;
       * never set it anywhere else. `userType` is read from the profiles table,
       * not from the JWT — see that file for why.
       */
      user?: {
        userId: string
        userType: UserType
        email: string
      }

      /**
       * The raw bearer token, kept for calls that must act on the session
       * itself (logout revokes it). Also set only by authenticate.
       */
      accessToken?: string

      /**
       * Query params after zod parsing, set by middlewares/validate.ts.
       * Express 5's req.query is a read-only getter, so validated query cannot
       * be written back onto it. Cast to the schema's inferred type at use.
       */
      validatedQuery?: unknown
    }
  }
}

export {}
