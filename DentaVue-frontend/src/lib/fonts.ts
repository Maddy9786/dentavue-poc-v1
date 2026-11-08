import { Nunito } from 'next/font/google'

/**
 * The app typeface — THE ONLY PLACE THE FONT IS NAMED.
 *
 * To swap it, change this file and nothing else:
 *   1. swap the next/font import (e.g. `Quicksand`, `Baloo_2`, `Figtree`)
 *   2. swap the call below
 * The CSS variable stays `--font-app`, so tokens/typography.css, layout.tsx and
 * every component keep working untouched.
 *
 * Currently Nunito. The design specifies SF Pro Rounded, which Apple's licence
 * forbids embedding in a website — see the note in styles/tokens/typography.css.
 *
 * next/font self-hosts the files (no runtime request to Google) and generates a
 * metric-matched fallback so swapping the face does not reflow the page. No
 * `weight` is listed because Nunito is variable: one file covers 400/500/600.
 */
export const appFont = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-app',
})
