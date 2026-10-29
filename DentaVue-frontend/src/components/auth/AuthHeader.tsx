import DentaVueLogo from '@/icons/teeth-ai.svg'

/**
 * Logo + title + subtitle block, shared by the three sign-in screens.
 *
 * Spec: the mark sits in a 158px circle; the title is 24px/24px and the subtitle
 * 20px/30px, both centred on Text primary.
 *
 * The <h1> is the title — one per screen, and it is the real page heading, so
 * screen-reader users landing here hear "Sign in" first.
 *
 * The mark is aria-hidden: the <h1> beside it already names the screen, and the
 * brand is stated by the page title. Announcing "DentaVue" here would just make
 * a screen-reader user hear it twice before the thing they came for.
 */
export function AuthHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <header className="flex flex-col items-center">
      <div className="flex size-[158px] items-center justify-center rounded-full bg-surface">
        <DentaVueLogo className="size-[94px]" aria-hidden="true" focusable="false" />
      </div>

      <h1 className="mt-2xl text-h1-xl font-regular text-foreground">{title}</h1>
      <p className="mt-md text-h1-lg font-regular text-foreground">{subtitle}</p>
    </header>
  )
}