/**
 * Static content for the patient home screen.
 *
 * Every value here is placeholder/mock — this screen is a presentational build
 * of the "Home Blue" design, not yet wired to real data. When the dashboard API
 * exists (it is not in the spec yet — see the coverage gap in CLAUDE.md), these
 * shapes are what the endpoint should return, so a real fetch drops in where the
 * page imports this.
 *
 * A note carried from the project scope: AI imaging is deliberately NOT
 * positioned as diagnostic (current VLMs miss micro-calcifications and early
 * enamel changes). The copy here is illustrative wellness framing, not a
 * clinical claim, and should stay that way.
 */

export interface OralHealthIndex {
  score: number
  max: number
  condition: string
  pointsFromLastScan: number
  confidence: number
  lastScan: string
  nextScan: string
  nextScanDate?: string
  stats: { label: string; value: string; note: string }[]
}

export type MetricTone = 'positive' | 'watch'

export interface HealthMetric {
  id: string
  title: string
  description: string
  status: string
  tone: MetricTone
  trend: string
}

export interface AiInsight {
  updated: string
  /** Short teaser shown on the card — the "for now / signed-out" view. */
  body: string
  /**
   * The full analysis, shown only to a signed-in user. Longer than fits the
   * card, so the dialog scrolls. In production this is the AI's write-up of an
   * uploaded scan; kept as paragraphs so it renders cleanly and a real response
   * (any number of paragraphs) drops in.
   */
  fullBody: string[]
}

export interface ProgressPhoto {
  id: string
  stage: string
  dateLabel: string
  score: number
  /**
   * Image URL. A default asset for now / when signed out; for a signed-in user
   * these become the real scans pulled from the database — the "previous"
   * upload and the "present" image with AI-flagged problems resolved. Driving
   * the card from this field is what lets those DB URLs replace the defaults.
   */
  image: string
}

/**
 * A recommended dentist. This whole list is a placeholder for a future
 * area-wise search / AI recommendation API: every field here — name, specialty,
 * rating, reviews, fee, and the portrait `image` — is expected to arrive per
 * result from that endpoint. Keeping the card driven entirely by this shape (no
 * hard-coded text or images in the component) is what lets a real response drop
 * straight in.
 */
export interface Dentist {
  id: string
  name: string
  specialty: string
  rating: number
  reviews: number
  startsAt: string
  /**
   * Portrait URL. A local asset for now; a search result will supply a remote
   * URL — add its host to next.config.ts `images.remotePatterns` when it does.
   */
  image: string
}

export interface ComingSoonItem {
  id: string
  title: string
  description: string
}

export const oralHealthIndex: OralHealthIndex = {
  score: 82,
  max: 100,
  condition: 'Good condition',
  pointsFromLastScan: 4,
  confidence: 92,
  lastScan: '2 days ago',
  nextScan: 'in 12 days',
  nextScanDate: 'Dec 3, 2026',
  stats: [
    { label: 'Healthy Areas', value: '5 of 6', note: 'looking good' },
    { label: 'Needs Care', value: '1 area', note: 'tooth cleanliness' },
    { label: 'Score Trend', value: '+4 pts', note: 'since last scan' },
  ],
}

export const healthMetrics: HealthMetric[] = [
  {
    id: 'gum-lower',
    title: 'Gum Health',
    description: 'Redness is settling nicely along your lower gums.',
    status: 'Improving',
    tone: 'positive',
    trend: '5%',
  },
  {
    id: 'enamel',
    title: 'Tooth Strength',
    description: 'Tooth surfaces look strong · gentle wear on front edges.',
    status: 'Healthy',
    tone: 'positive',
    trend: 'stable',
  },
  {
    id: 'oral-tissue',
    title: 'Tongue & Cheeks',
    description: 'Tongue and inner cheeks look clear and healthy.',
    status: 'Normal',
    tone: 'positive',
    trend: 'stable',
  },
  {
    id: 'plaque-risk',
    title: 'Tooth Cleanliness',
    description: 'A little soft buildup near your upper back teeth.',
    status: 'Watch',
    tone: 'watch',
    trend: 'stable',
  },
  {
    id: 'gum-line',
    title: 'Gum Line',
    description: 'Gums are sitting evenly around your teeth.',
    status: 'Healthy',
    tone: 'positive',
    trend: 'stable',
  },
  {
    id: 'tartar-stain',
    title: 'Stains & Tartar',
    description: 'No hardened tartar or surface staining seen.',
    status: 'Healthy',
    tone: 'positive',
    trend: 'stable',
  },
]

export const aiInsight: AiInsight = {
  updated: '2 days ago',
  body: 'Your gums look slightly red near your lower-left back teeth. This usually happens from brushing a little too firmly — switching to gentle circular strokes should help it settle within two weeks.',
  fullBody: [
    'Your gums look slightly red near your lower-left back teeth. This usually happens from brushing a little too firmly — switching to gentle circular strokes should help it settle within two weeks.',
    'Compared with your previous check, everyday buildup along your upper gum line is noticeably cleaner, which shows your daily routine is working well there. Keep it up.',
    'The lower-left gum edge shows mild surface redness from everyday irritation. Angling a soft brush gently toward where the gum meets the tooth helps calm this down quickly.',
    'Your tongue and inner cheeks look healthy and clear, with no new changes since your last check. Your next scan in 12 days is a great time to see the lower-left area bounce back.',
    'This guide is an everyday oral care summary from your photos and is not a medical diagnosis. If you ever feel pain, soreness, or bleeding that does not settle, book a visit with a dentist.',
  ],
}

/** One recommended step in the AI insight's "What to do" list. */
export interface InsightAction {
  id: string
  title: string
  detail: string
  /**
   * done → advice already given for the flagged area (rendered with a check);
   * todo → an upcoming action such as the re-scan (rendered with an alert mark).
   */
  done: boolean
}

/**
 * The full AI-insight page (reached from "See full analysis" on Home, signed-in
 * only). Placeholder content today — in production this is the AI's read of an
 * uploaded scan. Framed as wellness guidance, not diagnosis, per the scope note;
 * the "What the scan shows" pair reuses `progressPhotos` above.
 */
export interface AiInsightDetail {
  /** Headline for the flagged finding, e.g. "Gum health dip · lower-left". */
  title: string
  updated: string
  confidence: number
  /** Short status word — mirrors the home metric tone ("Watch"). */
  status: string
  summary: string
  likelyCauses: string[]
  whatToDo: InsightAction[]
  /** Safety-net line in the caution box; wellness framing, never a diagnosis. */
  caution: string
  ctaLabel: string
}

export const aiInsightDetail: AiInsightDetail = {
  title: 'Gums need a little gentle care · lower-left',
  updated: '2 days ago',
  confidence: 92,
  status: 'Watch',
  summary:
    'Your gums look slightly red near your lower-left back teeth. This usually happens from brushing a little too firmly — switching to gentle circular strokes should help it settle within two weeks.',
  likelyCauses: [
    'Brushing a bit too firmly along the gum edge',
    'Food or soft buildup sitting between the back teeth',
    'Using a toothbrush with medium or hard bristles',
  ],
  whatToDo: [
    {
      id: 'strokes',
      title: 'Use gentle, circular brushing strokes',
      detail: 'Angle a soft brush lightly toward the gum edge',
      done: true,
    },
    {
      id: 'floss',
      title: 'Clean between your lower-left back teeth daily',
      detail: 'Gently clear out trapped food before bedtime',
      done: true,
    },
    {
      id: 'rescan',
      title: 'Take a quick check-in scan in 2 weeks',
      detail: 'See how nicely the redness has settled down',
      done: false,
    },
  ],
  caution: 'If the area feels sore or bleeds when you brush, book a quick visit with a dentist.',
  ctaLabel: 'Set a check-in reminder',
}

/** One row of the compare screen's "What you'll see" list. */
export interface CompareChecklistItem {
  id: string
  label: string
  /** true → a check mark; false → an alert mark (the "flags" row). */
  done: boolean
}

/**
 * The single-scan compare view (reached from "View Scan" on Home). This is the
 * state when only ONE scan is on record: the baseline sits beside an empty "Next
 * Scan" tile, and the screen explains what a second scan unlocks.
 *
 * All placeholder for now — in production these come from the user's stored scans
 * and the AI's analysis. The two-scan (and latest-two-of-many) comparison is a
 * separate view, added later; see the note in the /compare page.
 */
export interface CompareSingleView {
  /** When the next scan is due — shown under the empty placeholder tile. */
  nextScanDue: string
  unlockTitle: string
  unlockBody: string
  whatYouWillSee: CompareChecklistItem[]
  ctaLabel: string
}

export const compareSingle: CompareSingleView = {
  nextScanDue: 'In 12 days',
  unlockTitle: 'Comparison unlocks with your second scan',
  unlockBody:
    'Your Apr 8 scan is saved as the baseline. Scan again and DentaVue will show what changed area by area.',
  whatYouWillSee: [
    { id: 'side-by-side', label: 'Side-by-side photos with score change', done: true },
    { id: 'heatmap', label: 'Risk heatmap by mouth area', done: true },
    { id: 'flags', label: 'Improved / stable / needs-attention flags', done: false },
  ],
  ctaLabel: 'Scan Now',
}

/** Status tone for a compared metric — mirrors the design's badge colours. */
export type CompareMetricTone = 'improving' | 'stable' | 'attention'

/** One metric row on the two-scan compare (e.g. "Gum health index 72 → 64"). */
export interface CompareMetric {
  id: string
  label: string
  /** Before / after values, already formatted (the unit, if any, is on `to`). */
  from: string
  to: string
  badge: string
  tone: CompareMetricTone
}

/**
 * The two-scan compare view — shown when at least two scans are on record (the
 * latest two). The scans themselves come from `progressPhotos`; this holds the
 * comparison read-out. All placeholder for now — in production the metrics and
 * note are the AI's diff of the two scans (wellness framing, not diagnosis).
 */
export interface CompareTwoView {
  /** Positive/plain-language summary of the change. */
  note: string
  metrics: CompareMetric[]
  overall: {
    title: string
    subtitle: string
    /** Net score change since the baseline; `direction` picks the arrow. */
    points: number
    direction: 'up' | 'down'
  }
  nextScan: { inLabel: string; date: string }
  ctaLabel: string
}

export const compareTwo: CompareTwoView = {
  note: 'Nice progress — gum redness along the lower line has visibly reduced in two weeks.',
  metrics: [
    { id: 'gum-index', label: 'Gum Health', from: '75', to: '100', badge: 'Improving', tone: 'improving' },
    { id: 'plaque', label: 'Tooth Cleanliness', from: '75', to: '75', badge: 'Stable', tone: 'stable' },
    { id: 'pocket', label: 'Gum Line (est.)', from: '~2 mm', to: '~2 mm', badge: 'Stable', tone: 'stable' },
    { id: 'tissue', label: 'Tongue & Cheeks', from: '100', to: '100', badge: 'Stable', tone: 'stable' },
    { id: 'enamel', label: 'Tooth Strength', from: '75', to: '75', badge: 'Stable', tone: 'stable' },
    { id: 'tartar-stain', label: 'Stains & Tartar', from: '75', to: '100', badge: 'Improving', tone: 'improving' },
  ],
  overall: {
    title: 'Overall · 60-day change',
    subtitle: 'Recommend hygiene review',
    points: 8,
    direction: 'down',
  },
  nextScan: { inLabel: 'in 14 days', date: '6 May' },
  ctaLabel: 'View full report',
}

export const progressPhotos: ProgressPhoto[] = [
  { id: 'prev', stage: 'Previous', dateLabel: 'Mar 25', score: 78, image: '/images/mouth-previous.png' },
  { id: 'latest', stage: 'Latest', dateLabel: 'Apr 8', score: 78, image: '/images/mouth-present.png' },
]

export const recommendedDentists: Dentist[] = [
  {
    id: 'sarah-mitchell-1',
    name: 'Dr. Sarah Mitchell',
    specialty: 'General Dentist',
    rating: 3,
    reviews: 25,
    startsAt: '£800',
    image: '/images/doctor.png',
  },
  {
    id: 'sarah-mitchell-2',
    name: 'Dr. Sarah Mitchell',
    specialty: 'General Dentist',
    rating: 3,
    reviews: 25,
    startsAt: '£800',
    image: '/images/doctor.png',
  },
]

export const comingSoon: ComingSoonItem[] = [
  {
    id: 'oral-cancer',
    title: 'Oral cancer screening',
    description: 'Track soft-tissue changes over time',
  },
  {
    id: 'apple-watch',
    title: 'Apple watch',
    description: 'Track your data and get notified',
  },
]

/**
 * Guided-scan prep steps — the first (and, for now, only) screen of the scan
 * flow. Static instructional copy, not AI or user data; the `icon` keys map to
 * SVGs in the guided-scan screen. The camera capture itself is a later step of
 * the same flow (the screen's "Scan Now" CTA opens it).
 */
export type GuidedScanIcon = 'lighting' | 'smile' | 'tongue' | 'tilt-upper' | 'tilt-lower'

export interface GuidedScanStep {
  id: string
  title: string
  detail: string
  icon: GuidedScanIcon
}

export const guidedScan: {
  lead: string
  highlight: string
  intro: string
  steps: GuidedScanStep[]
  ctaLabel: string
} = {
  lead: "Let's prep your",
  highlight: 'perfect scan.',
  intro: 'Follow these five steps for the most accurate reading.',
  steps: [
    {
      id: 'lighting',
      title: 'Find good lighting',
      detail: 'Face a window or soft light source.',
      icon: 'lighting',
    },
    {
      id: 'smile',
      title: 'A wide, relaxed smile',
      detail: 'Show your front teeth and gum line.',
      icon: 'smile',
    },
    {
      id: 'tongue',
      title: 'Stick out your tongue',
      detail: 'We check the surface for coating.',
      icon: 'tongue',
    },
    {
      id: 'upper',
      title: 'Tilt for upper teeth',
      detail: 'Lift your chin slightly upward.',
      icon: 'tilt-upper',
    },
    {
      id: 'lower',
      title: 'Tilt for lower teeth',
      detail: 'Lower your chin to finish.',
      icon: 'tilt-lower',
    },
  ],
  ctaLabel: 'Scan Now',
}

/**
 * The photo-capture steps — one image per angle, taken in order on the capture
 * screen. Static sequence, not AI/user data; the labels drive the progress bar
 * and the "Step N · <label>" chip. The four images together make one scan; the
 * front-teeth shot is the one persisted today (see PhotoCaptureFlow), the rest
 * are held for the multi-image analysis a real AI step would use.
 */
export interface PhotoCaptureStep {
  id: string
  label: string
}

export const photoCaptureSteps: PhotoCaptureStep[] = [
  { id: 'front-teeth', label: 'Front teeth' },
  { id: 'upper-gums', label: 'Upper gums' },
  { id: 'tongue', label: 'Tongue' },
  { id: 'lower-gums', label: 'Lower gums' },
]

/**
 * Per-angle capture quality shown on the "Quality check" screen after the four
 * shots. `sharp` = clear enough; `retake` = flagged (with a short reason).
 *
 * SUPERSEDED — the quality check is now REAL, computed per shot on the capture
 * canvas by `src/lib/imageQuality.ts` (darkness + blur). This fixed sample is no
 * longer used by the flow; the `ScanQualityStatus` type it defines is kept
 * because QualityCheckReview and imageQuality share the vocabulary.
 */
export type ScanQualityStatus = 'sharp' | 'retake'

/**
 * The "Analysing your scan" progress screen shown after Analyse, before results.
 *
 * PLACEHOLDER — there is no AI yet, so the screen simulates progress: the
 * percentage counts up and the steps tick off on thresholds (see AnalysingScan).
 * When the AI layer exists it drives the real percentage and step states; the
 * copy stays. `steps[i].doneAt` is the percentage at which that step flips to
 * done — the first is 0 (image quality was verified on the previous screen).
 */
export const analysingScan: {
  title: string
  description: string
  steps: { id: string; label: string; doneAt: number }[]
} = {
  title: 'Reviewing your mouth photos',
  description: 'DentaVue is checking your teeth, gums and tongue across 6 everyday care areas.',
  steps: [
    { id: 'quality', label: 'Photo clarity verified', doneAt: 0 },
    { id: 'gum-recession', label: 'Checking gums & tooth surfaces', doneAt: 50 },
    { id: 'report', label: 'Preparing your personal care guide…', doneAt: 100 },
  ],
}

/**
 * The "Risk assessment" summary shown after analysing — one row per tracked area
 * with a risk level.
 *
 * PLACEHOLDER — hard-coded today; later this is the AI's response derived from the
 * four uploaded images. The screen reads only from this object, so a real result
 * drops straight in. `tone` is the badge colour: `good` = teal (Low/Medium),
 * `attention` = amber (needs a look) — the AI maps its own levels onto these.
 */
export type RiskTone = 'good' | 'attention'

export interface RiskItem {
  id: string
  title: string
  detail: string
  level: string
  tone: RiskTone
}

export const riskAssessment: {
  completeTitle: string
  completeSubtitle: string
  ctaLabel: string
  items: RiskItem[]
} = {
  completeTitle: 'Your mouth check is ready',
  completeSubtitle: 'Across 6 areas tracked this cycle',
  ctaLabel: 'View full results',
  items: [
    {
      id: 'oral-tissue',
      title: 'Tongue & Cheeks',
      detail: 'Tongue, roof of mouth & inner cheeks - all clear',
      level: 'Low',
      tone: 'good',
    },
    {
      id: 'gum-inflammation',
      title: 'Gum Health',
      detail: 'Lower-left gum edge - settling nicely',
      level: 'Low',
      tone: 'good',
    },
    {
      id: 'plaque-buildup',
      title: 'Tooth Cleanliness',
      detail: 'Upper-right back teeth - give extra brush time',
      level: 'Medium',
      tone: 'good',
    },
    {
      id: 'gum-line-change',
      title: 'Gum Line',
      detail: 'Gum edge sits slightly lower on a few teeth',
      level: 'Attention',
      tone: 'attention',
    },
    {
      id: 'enamel-wear',
      title: 'Tooth Strength',
      detail: 'Surface smoothness and biting edges',
      level: 'Low',
      tone: 'good',
    },
    {
      id: 'tartar-stain',
      title: 'Stains & Tartar',
      detail: 'Tea/coffee staining or hardened buildup',
      level: 'Low',
      tone: 'good',
    },
  ],
}

/**
 * The full "Scan results" screen — the last screen of the guided-scan flow.
 *
 * PLACEHOLDER — everything here is hard-coded and will be the AI's response to the
 * four uploaded images later (the score, the "at a glance" reads, the findings,
 * the monitor note). Only the annotated-scan carousel shows the real uploaded
 * images; the AI will annotate them (circling issues) in a later pass. `glance[]`
 * icons map to SVGs in the results screen.
 */
export type GlanceIcon = 'gum' | 'enamel' | 'tissue' | 'plaque'

export interface ScanResultGlance {
  id: string
  icon: GlanceIcon
  title: string
  description: string
  status: string
  tone: MetricTone
  trend: string
}

export interface ScanResultFinding {
  id: string
  title: string
  detail: string
  /** `good` → check glyph; `watch` → alert glyph. */
  status: 'good' | 'watch'
}

export interface ScanResultAction {
  id: string
  icon: 'floss' | 'rescan'
  title: string
  detail: string
}

export const scanResults: {
  date: string
  time: string
  condition: string
  score: number
  max: number
  pointsFromLastScan: number
  confidence: number
  confidenceNote: string
  glance: ScanResultGlance[]
  findingsMeta: string
  findings: ScanResultFinding[]
  monitor: { badge: string; title: string; body: string; recommended: string }
  actions: ScanResultAction[]
} = {
  date: 'Apr 8, 2026',
  time: '01:20 PM',
  condition: 'Good condition',
  score: 82,
  max: 100,
  pointsFromLastScan: 4,
  confidence: 80,
  confidenceNote: 'Improved this cycle. 1 area needs a closer look.',
  glance: [
    {
      id: 'gum-health',
      icon: 'gum',
      title: 'Gum Health',
      description: 'Redness is settling nicely along your lower gums.',
      status: 'Improving',
      tone: 'positive',
      trend: '5%',
    },
    {
      id: 'enamel',
      icon: 'enamel',
      title: 'Tooth Strength',
      description: 'Tooth surfaces look strong · gentle wear on front edges.',
      status: 'Healthy',
      tone: 'positive',
      trend: 'stable',
    },
    {
      id: 'oral-tissue',
      icon: 'tissue',
      title: 'Tongue & Cheeks',
      description: 'Tongue and inner cheeks look clear and healthy.',
      status: 'Normal',
      tone: 'positive',
      trend: 'stable',
    },
    {
      id: 'plaque-risk',
      icon: 'plaque',
      title: 'Tooth Cleanliness',
      description: 'A little soft buildup near your upper back teeth.',
      status: 'Watch',
      tone: 'watch',
      trend: 'stable',
    },
    {
      id: 'gum-line',
      icon: 'gum',
      title: 'Gum Line',
      description: 'Gums are sitting evenly around your teeth.',
      status: 'Healthy',
      tone: 'positive',
      trend: 'stable',
    },
    {
      id: 'tartar-stain',
      icon: 'plaque',
      title: 'Stains & Tartar',
      description: 'No hardened tartar or surface staining seen.',
      status: 'Healthy',
      tone: 'positive',
      trend: 'stable',
    },
  ],
  findingsMeta: 'From your Apr 8 scan',
  findings: [
    {
      id: 'gum-inflammation',
      title: 'Gums look calmer and less red',
      detail: 'Lower-left gum edge compared with your last check',
      status: 'good',
    },
    {
      id: 'tissue',
      title: 'Tongue and inner cheeks look clear',
      detail: 'Healthy everyday colour with no spots noticed',
      status: 'good',
    },
    {
      id: 'plaque',
      title: 'A little soft buildup on the back teeth',
      detail: 'Give your upper-right back teeth a few extra seconds when brushing',
      status: 'watch',
    },
  ],
  monitor: {
    badge: 'Keep an eye on',
    title: 'Gum edge sitting slightly lower',
    body: "We noticed the gum line looks a tiny bit lower on a couple of upper teeth. It's very common and often linked to firm brushing — worth mentioning at your next routine check-up.",
    recommended: 'having a dentist or hygienist take a quick look at your next visit.',
  },
  actions: [
    {
      id: 'floss',
      icon: 'floss',
      title: 'Clean between your upper-right teeth daily',
      detail: 'Clears soft buildup around the back chewing teeth',
    },
    {
      id: 'rescan',
      icon: 'rescan',
      title: 'Take a check-in scan in 2 weeks',
      detail: "We'll help you track how your gums are settling",
    },
  ],
}
