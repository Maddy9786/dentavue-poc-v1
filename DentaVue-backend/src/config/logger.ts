import pino from 'pino'
import { env, isProduction } from './env.js'

/**
 * `transport` is spread conditionally rather than set to `undefined` in
 * production: tsconfig has exactOptionalPropertyTypes, so an explicit undefined
 * is not the same as an absent key and pino's types reject it.
 *
 * pino-pretty is a devDependency — it must never be reached in production,
 * where logs go out as raw JSON for the log collector to parse anyway.
 */
export const logger = pino({
  level: isProduction ? 'info' : 'debug',
  ...(isProduction
    ? {}
    : { transport: { target: 'pino-pretty', options: { colorize: true } } }),

  // This is a health app: request bodies carry medical history, OTPs, and bank
  // details. Redact aggressively — logs are the easiest place to leak PHI.
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.body.password',
      'req.body.confirmPassword',
      'req.body.otp',
      'req.body.accountNumber',
      'req.body.refreshToken',
      '*.accessToken',
      '*.refreshToken',
    ],
    censor: '[redacted]',
  },
  base: { env: env.NODE_ENV },
})
