import type { Metadata } from 'next'
import { StatusScreen } from '@/components/feedback/StatusScreen'
import { RecoveryActions } from '@/components/feedback/RecoveryActions'
import { SearchGlyph } from '@/components/ui/StatusGlyphs'

export const metadata: Metadata = {
  title: 'Page not found',
}

/**
 * 404 — Next.js renders this for an unmatched route or any `notFound()` call.
 *
 * A server component: the copy is static, and only the recovery buttons need the
 * client (router). Framed calmly — a missing page is not an error — with a way
 * back to a working screen. See StatusScreen for the shared visual + a11y.
 */
export default function NotFound() {
  return (
    <StatusScreen
      tone="neutral"
      icon={<SearchGlyph />}
      eyebrow="404"
      title="Page not found"
      description="We couldn’t find the page you were looking for. It may have moved, or the link may be out of date."
      actions={<RecoveryActions showBack />}
    />
  )
}
