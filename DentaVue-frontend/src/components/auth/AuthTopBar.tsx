'use client'

import { useRouter } from 'next/navigation'
import ArrowLeftIcon from '@/icons/arrow-left.svg'

/**
 * Back arrow + centred title, per the sign-up spec (20px / 100% / 500 / -2%).
 *
 * router.back() rather than a hard-coded destination: the screen is reachable
 * from more than one place, and sending everyone to the same route would strip
 * people of their actual history. If there is nothing to go back to — someone
 * opened the link directly — `fallbackHref` is used instead, so the arrow is
 * never a dead control.
 *
 * The title is the page's <h1>. The arrow is absolutely positioned rather than
 * laid out in a flex row so the title stays centred on the SCREEN, not in the
 * space left over beside the arrow — with a row those two differ by half the
 * arrow's width, which is exactly the kind of off-by-12px that looks wrong
 * without anyone being able to say why.
 */
export function AuthTopBar({ title, fallbackHref }: { title: string; fallbackHref: string }) {
  const router = useRouter()

  const handleBack = () => {
    if (window.history.length > 1) router.back()
    else router.push(fallbackHref)
  }

  return (
    <header className="relative mb-2xl flex h-8 items-center justify-center">
      <button
        type="button"
        onClick={handleBack}
        aria-label="Go back"
        className="absolute left-0 grid size-8 place-items-center rounded-1 text-foreground focus-visible:outline-primary focus-visible:outline-2 focus-visible:outline-offset-2"
      >
        <ArrowLeftIcon aria-hidden="true" focusable="false" className="size-6" />
      </button>

      <h1 className="text-h1-lg leading-none font-medium tracking-tight text-foreground">{title}</h1>
    </header>
  )
}
