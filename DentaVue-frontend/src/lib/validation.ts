/**
 * Client-side form validation.
 *
 * This is a UX affordance, not a security boundary — it exists so a user finds
 * out about a typo without a round trip. The API re-validates everything; never
 * treat a value as safe because it passed through here.
 *
 * Messages say what to do, not what went wrong ("Enter a valid email address",
 * not "Invalid input"), and never blame the user.
 */

/**
 * Deliberately permissive. Exhaustive email regexes reject valid addresses
 * (apostrophes, new TLDs, unicode) and still cannot prove deliverability — only
 * sending a mail does. So: catch the obvious typo, let the API decide the rest.
 */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

export function validateEmail(value: string): string | undefined {
  const email = value.trim()
  if (!email) return 'Enter your email address'
  if (!EMAIL.test(email)) return 'Enter a valid email address'
  return undefined
}

/**
 * Sign-in only checks that something was typed. Strength rules belong on
 * sign-up: telling an existing user their (already accepted) password is "too
 * short" at sign-in is both wrong and a hint to an attacker about what is
 * stored. Length is checked purely to avoid a pointless request.
 */
export function validatePassword(value: string): string | undefined {
  if (!value) return 'Enter your password'
  if (value.length < 8) return 'Password must be at least 8 characters'
  return undefined
}

/**
 * Phone numbers are accepted loosely on purpose: the brief is that any entered
 * number signs in. We only check there are enough digits to be a real number.
 * The country code is supplied separately by the UI.
 *
 * Note the API spec's examples are US-format while Razorpay/MSG91 imply an
 * India-first launch — the target region is still unconfirmed, so this stays
 * permissive rather than encoding a guess.
 */
export function validatePhone(value: string): string | undefined {
  const digits = value.replace(/\D/g, '')
  if (!digits) return 'Enter your phone number'
  if (digits.length < 6 || digits.length > 14) return 'Enter a valid phone number'
  return undefined
}

/** Joins a country code and a local number into E.164 (`+919876543210`). */
export function toE164(countryCode: string, localNumber: string): string {
  const cc = countryCode.replace(/\D/g, '')
  const digits = localNumber.replace(/\D/g, '')
  return `+${cc}${digits}`
}
