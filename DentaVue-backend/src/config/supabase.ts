import { createClient } from '@supabase/supabase-js'
import { env } from './env.js'

/**
 * Two clients, because they carry different authority. Using the wrong one is
 * the most likely way to open a hole here.
 *
 * supabaseAdmin — service-role key. Bypasses Row Level Security ENTIRELY: every
 *   query it makes is fully trusted, so the database will not stop a patient
 *   reading another patient's appointment. Authorization is this API's job.
 *   Use for: table access, admin auth operations, verifying a caller's JWT.
 *   Never expose this client, its key, or an unfiltered result of it.
 *
 * supabaseAuth — anon key. The public, RLS-respecting client. Sign-in flows run
 *   through it because they are, by definition, unauthenticated: the caller has
 *   no session yet. Signing in with the service-role client would work but would
 *   run the flow with god rights for no reason.
 */

const shared = {
  auth: {
    // This is a stateless API: there is no browser and no session to persist,
    // and every request must be authenticated on its own. Leaving these on lets
    // one caller's session leak into another's request.
    autoRefreshToken: false,
    persistSession: false,
  },
} as const

export const supabaseAdmin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, shared)

export const supabaseAuth = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
  auth: {
    ...shared.auth,
    // Implicit, not the PKCE default. PKCE returns an auth code that must be
    // exchanged with the code_verifier generated when the URL was built — but
    // this client is stateless (persistSession: false), so it has nowhere to
    // keep that verifier between the two calls, and the exchange would fail.
    // Implicit returns the tokens straight in the redirect hash, which the
    // frontend callback relays back here to validate. The tradeoff is that the
    // tokens ride in the URL briefly; the callback strips them immediately.
    // Only OAuth and magic-link flows read this — password and phone sign-in
    // return their session directly and are unaffected.
    flowType: 'implicit',
  },
})
