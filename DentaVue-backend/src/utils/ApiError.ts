/**
 * Thrown by services and controllers; converted to an error envelope by the
 * error middleware. Anything that isn't an ApiError is treated as a bug and
 * reported as a generic 500 without leaking internals to the client.
 */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message)
    this.name = 'ApiError'
    Error.captureStackTrace(this, this.constructor)
  }

  static badRequest(message: string, errors?: Record<string, string[]>) {
    return new ApiError(400, message, errors)
  }

  /** Caller is not authenticated, or the token is expired/invalid. */
  static unauthorized(message = 'Unauthorized') {
    return new ApiError(401, message)
  }

  /** Caller is authenticated but is the wrong persona, or lacks ownership. */
  static forbidden(message = 'Forbidden') {
    return new ApiError(403, message)
  }

  static notFound(message = 'Not found') {
    return new ApiError(404, message)
  }

  static conflict(message: string) {
    return new ApiError(409, message)
  }

  /** Well-formed request that fails field validation. */
  static unprocessable(message: string, errors?: Record<string, string[]>) {
    return new ApiError(422, message, errors)
  }
}
