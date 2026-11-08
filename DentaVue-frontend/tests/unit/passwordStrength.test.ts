import { describe, expect, it } from 'vitest'
import { getPasswordStrength, getPasswordStrengthLabel } from '@/lib/passwordStrength'

/**
 * The four sign-up mockups are the same screen in four validation states, so
 * this logic IS the feature — a strength meter that always said "Strong" would
 * look identical in a screenshot.
 *
 * The rule must stay identical to the API's (DentaVue-backend
 * src/validators/auth.validator.ts). If it drifts, the screen promises "Strong"
 * and the server rejects the password — so the boundary cases are pinned here.
 */

describe('getPasswordStrength', () => {
  it('is empty when nothing is typed — the third mockup shows no hint', () => {
    expect(getPasswordStrength('')).toBe('empty')
    expect(getPasswordStrengthLabel('empty')).toBeNull()
  })

  it('is strong only when every API rule is met', () => {
    expect(getPasswordStrength('SecurePass1')).toBe('strong')
    expect(getPasswordStrengthLabel('strong')).toBe('Strong Password')
  })

  it.each([
    ['Short1a', 'too short (7)'],
    ['alllowercase1', 'no uppercase'],
    ['ALLUPPERCASE1', 'no lowercase'],
    ['NoDigitsHere', 'no digit'],
    ['12345678', 'digits only'],
  ])('is weak for %s — %s', (password) => {
    expect(getPasswordStrength(password)).toBe('weak')
    expect(getPasswordStrengthLabel('weak')).toBe('Weak Password')
  })

  it('treats exactly 8 characters as the boundary, not 7', () => {
    expect(getPasswordStrength('Abcdef1')).toBe('weak') // 7
    expect(getPasswordStrength('Abcdefg1')).toBe('strong') // 8
  })

  it('accepts symbols without requiring them', () => {
    expect(getPasswordStrength('Secure!Pass1')).toBe('strong')
  })
})
