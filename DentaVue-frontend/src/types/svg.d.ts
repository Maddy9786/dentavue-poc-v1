/**
 * SVG imports are React components, not image URLs — see the SVGR rule in
 * next.config.ts.
 *
 * This overrides the `*.svg` declaration Next ships in its image types, which
 * types them as StaticImageData for next/image. That is the right default, but
 * it is not what this project does: every .svg here is compiled to a component,
 * so importing one and handing it to <Image> would fail at runtime while
 * typechecking cleanly.
 *
 * Raster brand marks (google.png) are unaffected and still go through <Image>.
 */
declare module '*.svg' {
  import type { FC, SVGProps } from 'react'

  const ReactComponent: FC<SVGProps<SVGSVGElement>>
  export default ReactComponent
}
