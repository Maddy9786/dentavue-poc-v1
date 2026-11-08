import type { Metadata, Viewport } from 'next'
import { appFont } from '@/lib/fonts'
import { Providers } from './providers'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'DentaVue',
    template: '%s | DentaVue',
  },
  description: 'Book dental appointments and manage your practice.',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // Matches --color-background. Add a dark entry once the dark palette exists;
  // see the note at the foot of styles/tokens/colors.css.
  themeColor: '#fbf8f4',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // The font variable must land on <html> so --font-app is in scope for the
  // :root-level tokens that reference it.
  return (
    <html lang="en" className={appFont.variable}>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
