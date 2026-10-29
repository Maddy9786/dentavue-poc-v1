import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

/**
 * eslint-config-next 16 ships native flat config, so it is spread directly.
 * Do not wrap it in FlatCompat — the legacy shim hits a circular reference
 * while validating the config schema and throws.
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
]

export default eslintConfig
