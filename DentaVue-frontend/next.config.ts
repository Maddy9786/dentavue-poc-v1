import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  output: 'standalone',
  reactStrictMode: true,
  poweredByHeader: false,

  // Hide the Next.js dev-tools indicator (the floating "N" button) that shows in
  // development. It never ships in a production build; this also removes it from
  // `next dev` so it does not overlap the app's own bottom navigation.
  devIndicators: false,

  // Next 16 removed the `eslint` config key along with `next lint`; linting is
  // its own step (`npm run lint`) and no longer runs during the build.
  typescript: {
    ignoreBuildErrors: false,
  },

  images: {
    // Scan images (and later clinic photos, avatars) come from Supabase Storage
    // as signed URLs the backend returns. Allow the Storage object path on any
    // Supabase project host so ScanTile can render them with next/image; the
    // `*` matches the single project-ref subdomain, e.g. abcd1234.supabase.co.
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },

  turbopack: {
    rules: {
      /**
       * SVGR turns the files in src/icons into React components at build time,
       * so those .svg files ARE the components — there is no second hand-written
       * copy of the path data to drift from them.
       *
       * replaceAttrValues maps the design system's hexes onto its tokens as the
       * icon is compiled. That keeps the source files pristine Figma exports: a
       * re-export drops straight in and is still themed, with nothing to
       * hand-edit. The mapping is the whole reason not to just inline the SVGs —
       * as exported they hardcode #736B61, which would ignore a palette change
       * and stay dark in a dark theme.
       *
       * Keep these in sync with styles/tokens/colors.css. Hexes are matched
       * literally, so they must stay uppercase as Figma writes them.
       */
      '*.svg': {
        loaders: [
          {
            loader: '@svgr/webpack',
            options: {
              // Monochrome icons follow their container's text colour.
              // The two-tone logo maps onto the palette instead.
              replaceAttrValues: {
                '#736B61': 'currentColor',
                '#221E19': 'var(--color-foreground)',
                '#2FB6A0': 'var(--color-secondary)',
              },
              // Drop the exported width/height so size comes from CSS and the
              // viewBox does the scaling. Without this every icon is locked to
              // whatever px Figma happened to export.
              dimensions: false,
              svgo: true,
            },
          },
        ],
        as: '*.js',
      },
    },
  },
}

export default nextConfig
