/**
 * Route paths, mirroring the App Router groups in src/app.
 *
 * The (patient) and (provider) groups are URL-transparent — the parens keep
 * them out of the path — so both personas' routes share one namespace. Keep
 * segment names distinct across the two to avoid collisions.
 */

export const ROUTES = {
  home: '/',

  auth: {
    /** Method chooser — phone / email / Google / Apple. */
    signin: '/signin',
    signinEmail: '/signin/email',
    signinPhone: '/signin/phone',
    signup: '/signup',
    forgotPassword: '/forgot-password',
    resetPassword: '/reset-password',
    /** Takes ?phone=<e164> so the screen can show where the code went. */
    verifyOtp: '/verify-otp',
  },

  onboarding: {
    /** Step 1 — welcome splash (shown right after Create Account). */
    welcome: '/onboarding/welcome',
    /** Step 2 — persona chooser. */
    personas: '/onboarding',
    /** Step 3 — "Intelligence for your whole mouth" value props. */
    intro: '/onboarding/intro',
    /** Step 4 — create profile (personal info, health conditions, oral goals). */
    profile: '/onboarding/profile',
  },

  patient: {
    /** The patient home IS the app root — the dashboard lives at `/`. */
    dashboard: '/',
    appointments: '/appointments',
    appointment: (id: string) => `/appointments/${id}`,
    profile: '/profile',
    scan: '/scan',
    /** Guided-scan prep flow — the funnel every "Scan Now" entry now opens; its
     *  own CTA leads to the capture screen. */
    guidedScan: '/guided-scan',
    /** The multi-step photo-capture screen (front teeth → upper gums → tongue →
     *  lower gums), reached from the prep screen's "Scan Now". */
    photoCapture: '/guided-scan/capture',
    /** The analysing progress screen shown after "Analyse", before results. */
    analysing: '/guided-scan/analysing',
    /** The AI risk-assessment summary shown after analysing. */
    riskAssessment: '/guided-scan/risk-assessment',
    /** The full scan-results screen — the last screen of the guided-scan flow. */
    scanResults: '/guided-scan/results',
    notifications: '/notifications',
    /** Full AI-insight write-up — reached from "See full analysis" on Home. */
    aiInsight: '/ai-insight',
    /** Scan comparison — reached from "View Scan" on Home's Compare Progress. */
    compare: '/compare',
  },

  provider: {
    dashboard: '/provider/dashboard',
    availability: '/provider/availability',
    clinic: '/provider/clinic',
    services: '/provider/services',
    bankDetails: '/provider/bank-details',
  },
} as const
