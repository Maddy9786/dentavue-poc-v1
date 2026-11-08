import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/cn'

/**
 * Regression guard for a bug that was invisible until the page rendered.
 *
 * tailwind-merge only knows Tailwind's default theme. Our theme lives in CSS, so
 * unless every custom token is declared in cn.ts, twMerge treats `text-h2`
 * (font-size) and `text-on-primary` (colour) as the same group and drops one.
 * The element then inherits its text colour, which produced a real WCAG failure:
 * `bg-error text-on-error` rendered dark-on-red at 3.12:1 instead of white at
 * 5.32:1.
 *
 * If a token is added to styles/tokens/ but not to cn.ts, one of these fails.
 */

describe('cn — size and colour must not be treated as conflicting', () => {
  it.each([
    ['text-on-primary', 'text-h2'],
    ['text-on-secondary', 'text-h2'],
    ['text-on-error', 'text-h2'],
    ['text-on-success', 'text-body'],
    ['text-on-success-bg', 'text-body'],
    ['text-on-rating', 'text-nav'],
    ['text-foreground', 'text-h1'],
    ['text-foreground-secondary', 'text-h1-lg'],
  ])('keeps both %s and %s', (colour, size) => {
    const out = cn(colour, size)
    expect(out).toContain(colour)
    expect(out).toContain(size)
  })
})

describe('cn — genuine conflicts still collapse, last wins', () => {
  it('collapses two font sizes', () => {
    expect(cn('text-h1', 'text-body')).toBe('text-body')
  })

  it('collapses two text colours', () => {
    expect(cn('text-foreground', 'text-on-primary')).toBe('text-on-primary')
  })

  it('collapses two background colours', () => {
    expect(cn('bg-primary', 'bg-surface')).toBe('bg-surface')
  })

  it('lets a caller override a component default', () => {
    expect(cn('bg-primary text-on-primary', 'bg-error text-on-error')).toBe(
      'bg-error text-on-error',
    )
  })

  it('collapses custom font weights', () => {
    expect(cn('font-regular', 'font-semibold')).toBe('font-semibold')
  })
})

describe('cn — unrelated utilities all survive', () => {
  it('keeps fill, background, border and size together', () => {
    const out = cn('bg-primary', 'text-on-primary', 'border-border', 'text-h2', 'font-semibold')
    for (const c of ['bg-primary', 'text-on-primary', 'border-border', 'text-h2', 'font-semibold']) {
      expect(out).toContain(c)
    }
  })

  it('keeps spacing, radius and shadow together', () => {
    const out = cn('p-md', 'rounded-2', 'shadow-drop')
    for (const c of ['p-md', 'rounded-2', 'shadow-drop']) expect(out).toContain(c)
  })
})

/**
 * The geometry/effect tokens fail the opposite way to colours: stock twMerge
 * does not recognise them as conflicting, so BOTH survive and stylesheet order
 * — not intent — picks the winner. An override then silently does nothing.
 */
describe('cn — custom scales from geometry.css collapse correctly', () => {
  it('collapses the named spacing scale', () => {
    expect(cn('p-md', 'p-lg')).toBe('p-lg')
    expect(cn('gap-sm', 'gap-2xl')).toBe('gap-2xl')
    expect(cn('m-xs', 'm-4xl')).toBe('m-4xl')
  })

  it('collapses named spacing against Tailwind numeric spacing', () => {
    expect(cn('p-md', 'p-4')).toBe('p-4')
    expect(cn('p-4', 'p-md')).toBe('p-md')
  })

  it('collapses the Figma radius scale', () => {
    expect(cn('rounded-2', 'rounded-4')).toBe('rounded-4')
  })

  it('collapses the radius scale against Tailwind defaults', () => {
    expect(cn('rounded-2', 'rounded-lg')).toBe('rounded-lg')
  })

  it('collapses shadows from effects.css', () => {
    expect(cn('shadow-drop', 'shadow-elevated')).toBe('shadow-elevated')
    expect(cn('shadow-drop', 'shadow-website-drop')).toBe('shadow-website-drop')
  })
})
