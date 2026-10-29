/**
 * Validated access to public env vars.
 *
 * Next.js inlines `process.env.NEXT_PUBLIC_*` at build time, so these must be
 * referenced by their full literal name — destructuring `process.env` breaks
 * the substitution.
 */

function required(value: string | undefined, name: string): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}. See .env.example.`)
  }
  return value
}

export const env = {
  apiBaseUrl: required(process.env.NEXT_PUBLIC_API_BASE_URL, 'NEXT_PUBLIC_API_BASE_URL') ?? 'http://localhost:4000/v1',
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000',
} as const
