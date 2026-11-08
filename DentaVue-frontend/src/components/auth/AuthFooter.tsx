import Link from 'next/link'
import { ROUTES } from '@/constants/routes'

/**
 * "New here? Create an account".
 *
 * Spec: both 14px/21px — the question on Text second, the link on Text primary,
 * underlined. The underline is what marks it as a link: it must not rely on
 * colour alone, and here the two colours are close enough that colour carries no
 * signal at all (WCAG 1.4.1 Use of Colour).
 */
export function AuthFooter() {
  return (
    <p className="text-center text-h2 text-foreground-secondary">
      New here?{' '}
      <Link
        href={ROUTES.auth.signup}
        className="text-foreground underline underline-offset-2 rounded-1 focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        Create an account
      </Link>
    </p>
  )
}
