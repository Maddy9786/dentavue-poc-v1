/**
 * Tailwind v4 ships its own PostCSS plugin and handles @import, vendor
 * prefixing, and nesting internally — postcss-import and autoprefixer are not
 * needed alongside it.
 */
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
