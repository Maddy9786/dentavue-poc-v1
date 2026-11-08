/**
 * Password strength for the sign-up field.
 *
 * The design shows two states — "Strong Password" and "Weak Password" — so the
 * rule is deliberately the SAME one the API enforces (8+ chars, upper, lower,
 * digit; see DentaVue-backend src/validators/auth.validator.ts). That makes the
 * label mean something concrete: "Strong" is a promise that submitting will be
 * accepted, not a vague compliment. If the two ever drift, the screen will
 * cheerfully say "Strong" and then the server will reject it.
 *
 * Worth flagging to design: by this rule `Password1` reads as "Strong", which it
 * plainly is not. A two-state indicator can only report "meets the rules", so it
 * should probably say so. A real strength estimate (zxcvbn and friends) scores
 * guessability instead and would rate that password terrible — worth doing if
 * the label is meant to be advice rather than a validity check.
 */

export type PasswordStrength = 'empty' | 'weak' | 'strong'

export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'empty'

  const meetsAll =
    password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password)

  return meetsAll ? 'strong' : 'weak'
}

/** The design's copy. `empty` shows nothing — see the third mockup. */
export function getPasswordStrengthLabel(strength: PasswordStrength): string | null {
  switch (strength) {
    case 'strong':
      return 'Strong Password'
    case 'weak':
      return 'Weak Password'
    case 'empty':
      return null
  }
}
