import type { NextFunction, Request, Response } from 'express'
import type { ZodType } from 'zod'

interface ValidationSchemas {
  body?: ZodType
  query?: ZodType
  params?: ZodType
}

/**
 * Parses request input so handlers receive typed values rather than raw
 * strings. Failures throw ZodError, which errorHandler renders as a 422 with
 * field-level detail.
 *
 * `body` and `params` are replaced in place. `query` is not: Express 5 defines
 * req.query as a getter with no setter, so assigning to it throws. Validated
 * query lands on `req.validatedQuery` instead — read that, not req.query, on
 * any route with a query schema.
 */
export function validate(schemas: ValidationSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (schemas.body) req.body = schemas.body.parse(req.body)
    if (schemas.params) req.params = schemas.params.parse(req.params) as typeof req.params
    if (schemas.query) req.validatedQuery = schemas.query.parse(req.query)
    next()
  }
}
