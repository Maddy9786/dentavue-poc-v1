/**
 * The "OR" separator between the form and the social options.
 *
 * aria-hidden: it is a visual device, not information. A screen reader reaching
 * "OR" between two groups of controls learns nothing it cannot already tell from
 * the buttons themselves, and the alternative is announcing a stray word.
 */
export function AuthDivider() {
  return (
    <p aria-hidden="true" className="text-center text-h2 text-foreground-secondary">
      OR
    </p>
  )
}
