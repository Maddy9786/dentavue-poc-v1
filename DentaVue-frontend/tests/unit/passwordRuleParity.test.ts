import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { getPasswordStrength } from '@/lib/passwordStrength'

/**
 * Guards a cross-repo contract that nothing else can catch.
 *
 * The sign-up screen says "Strong Password" using DentaVue-Web's rule; the API
 * accepts or rejects using its own. They are two copies of one decision in two
 * repositories, and nothing links them — so if someone tightens the API to
 * demand a symbol, this app keeps promising "Strong" and every sign-up fails
 * with a server error the user cannot act on.
 *
 * This reads the backend validator as text (the repos are separate npm projects
 * and cannot import each other) and asserts the rules still match. It is
 * deliberately brittle: if the API's rules change, this SHOULD fail and force
 * getPasswordStrength to be updated alongside.
 *
 * Skipped when the backend is not checked out beside this repo, so a solo
 * frontend clone still passes.
 */

// Resolved from THIS file (tests/unit/), so three levels up is the directory
// holding both repos. Getting this wrong makes the suite skip silently and
// report green while checking nothing — which is worse than not having it.
const VALIDATOR = '../../../DentaVue-backend/src/validators/auth.validator.ts'

function readValidator(): string | null {
  try {
    return readFileSync(new URL(VALIDATOR, import.meta.url), 'utf8')
  } catch {
    return null
  }
}

const source = readValidator()

describe.skipIf(source === null)('password rules match the API', () => {
  it('the API still requires exactly: 8+, uppercase, lowercase, digit', () => {
    expect(source).toContain(".min(8, 'Password must be at least 8 characters')")
    expect(source).toContain('.regex(/[A-Z]/')
    expect(source).toContain('.regex(/[a-z]/')
    expect(source).toContain('.regex(/[0-9]/')
  })

  it('the API has NOT added a rule this app does not know about', () => {
    // Everything getPasswordStrength enforces. A new .regex() here means the
    // screen's "Strong" is now a lie.
    const regexRules = source!.match(/\.regex\(\/[^/]+\//g) ?? []
    const signupBlock = source!.slice(
      source!.indexOf('export const signupSchema'),
      source!.indexOf('export const signinSchema'),
    )
    const signupRules = signupBlock.match(/\.regex\(/g) ?? []

    expect(regexRules.length).toBeGreaterThan(0)
    expect(signupRules).toHaveLength(3) // upper, lower, digit — nothing more
  })

  it('a password this app calls strong satisfies every rule the API states', () => {
    const candidate = 'SecurePass1'
    expect(getPasswordStrength(candidate)).toBe('strong')

    expect(candidate.length).toBeGreaterThanOrEqual(8)
    expect(/[A-Z]/.test(candidate)).toBe(true)
    expect(/[a-z]/.test(candidate)).toBe(true)
    expect(/[0-9]/.test(candidate)).toBe(true)
  })
})
