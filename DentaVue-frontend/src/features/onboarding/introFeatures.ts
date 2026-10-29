/**
 * Onboarding — step 2 ("Intelligence for your whole mouth"): the value-prop
 * cards shown after the persona chooser.
 *
 * Static marketing copy, kept as data so the screen maps over it and cards can
 * be added/reordered without touching markup. `id` is the icon key (see the
 * screen's icon map); the icons are self-contained chips, so colour lives in the
 * SVG, not here.
 */
export interface IntroFeature {
  id: 'ai' | 'track' | 'share' | 'book'
  title: string
  description: string
}

export const introFeatures: IntroFeature[] = [
  {
    id: 'ai',
    title: 'AI detects early changes',
    description: 'Spots subtle shifts in gums, enamel and tissue before you can feel them.',
  },
  {
    id: 'track',
    title: 'Track health over time',
    description: 'Build a private timeline and watch your trends move the right direction.',
  },
  {
    id: 'share',
    title: 'Share with professionals',
    description: 'Export a clean report your dentist can read in seconds.',
  },
  {
    id: 'book',
    title: 'Book the right specialist',
    description: 'Matched from your scan, booked and paid in the app.',
  },
]
