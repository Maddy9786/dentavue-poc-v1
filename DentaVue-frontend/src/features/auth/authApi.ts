import { baseApi } from '@/services/api/baseApi'
import type { ApiEnvelope } from '@/types/api'
import { credentialsReceived, loggedOut, type AuthUser } from './authSlice'
import { isPhoneOtpMocked, issueMockOtp, verifyMockOtp } from './mockAuth'

/**
 * Auth endpoints (DentaVue_API_Endpoints.md #1–14).
 *
 * Reference pattern for every feature: inject into `baseApi`, type the envelope
 * on the query, and unwrap `data` in `transformResponse` so hooks return the
 * payload directly and components never see the envelope.
 */

/**
 * What the Create Account screen actually collects.
 *
 * The API spec (#1) also lists confirmPassword, userType, firstName, lastName
 * and phoneNumber as required — but the screen has no fields for any of them,
 * and the Figma puts a 16-step onboarding AFTER sign-up, which is where they are
 * gathered. The spec predates these screens. The backend validator was relaxed
 * to match: see DentaVue-backend src/validators/auth.validator.ts.
 */
interface SignupRequest {
  email: string
  password: string
  acceptTerms: true
}

interface SigninRequest {
  email: string
  password: string
}

interface Session {
  user: AuthUser
  accessToken: string
  refreshToken: string
}

interface SigninPhoneRequest {
  /** E.164, e.g. +919876543210. */
  phoneNumber: string
}

interface SigninPhoneResponse {
  phoneNumber: string
  otpSent: boolean
  /** Seconds until the code expires — drives the countdown on the OTP screen. */
  expiresInSeconds: number
}

interface VerifyPhoneOtpRequest {
  phoneNumber: string
  otp: string
}

/**
 * OAuth completion. The /auth/callback page relays the tokens Supabase returned
 * in the redirect hash; the backend re-validates the access token against
 * Supabase before trusting it, so these are not credentials the client mints.
 */
interface OAuthCompleteRequest {
  accessToken: string
  refreshToken: string
}

export const authApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    /**
     * Restores the session on app load. There is no access token after a reload
     * (it lived in memory), so this POSTs to /auth/session, which reads the
     * httpOnly refresh cookie and returns a fresh session. On success it stores
     * the session exactly like signin; a 401 (no/expired cookie) just leaves the
     * user signed out. `credentials: 'include'` on the base query sends the
     * cookie. Fired once on mount by the SessionLoader in providers.
     */
    session: builder.query<Session, void>({
      query: () => ({ url: '/auth/session', method: 'POST' }),
      transformResponse: (r: ApiEnvelope<Session>) => r.data,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        try {
          const { data } = await queryFulfilled
          dispatch(credentialsReceived(data))
        } catch {
          // No cookie / expired → stays signed out. Not an error to surface.
        }
      },
    }),

    signup: builder.mutation<Session, SignupRequest>({
      query: (body) => ({ url: '/auth/signup', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Session>) => r.data,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        // Sign-up now returns a real session (see the backend note): the account
        // is created AND signed in, so onboarding — which runs straight after —
        // is authenticated and can save the profile. Store it exactly like
        // signin. The try/catch keeps a failed sign-up from becoming an
        // unhandled rejection; the screen renders the error from the hook.
        try {
          const { data } = await queryFulfilled
          dispatch(credentialsReceived(data))
        } catch {
          // Handled by the component via the mutation's `error`.
        }
      },
    }),

    signin: builder.mutation<Session, SigninRequest>({
      query: (body) => ({ url: '/auth/signin', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Session>) => r.data,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        // The try/catch is not optional. `queryFulfilled` is a SEPARATE promise
        // from the `.unwrap()` the component awaits, and RTK Query does not catch
        // it for us — so on a failed sign-in (a wrong password, a 401) it rejects
        // with nobody listening, and Next surfaces it as an unhandled rejection
        // ("[object Object]" runtime overlay). The component renders the failure
        // from the hook's `error`; here we only care about the success path.
        try {
          const { data } = await queryFulfilled
          dispatch(credentialsReceived(data))
        } catch {
          // Handled by the component via the mutation's `error`.
        }
      },
    }),

    /**
     * Sends an SMS code. Any number the API accepts gets one.
     *
     * The `isPhoneOtpMocked()` branch is scaffolding — see mockAuth.ts. It sits
     * here, at the API boundary, so the screens are identical either way and
     * deleting the branch is the entire cost of switching to real Supabase.
     */
    signinPhone: builder.mutation<SigninPhoneResponse, SigninPhoneRequest>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        if (isPhoneOtpMocked()) return { data: issueMockOtp(arg.phoneNumber) }

        const result = await baseQuery({ url: '/auth/signin-phone', method: 'POST', body: arg })
        if (result.error) return { error: result.error }
        return { data: (result.data as ApiEnvelope<SigninPhoneResponse>).data }
      },
    }),

    verifyPhoneOtp: builder.mutation<Session, VerifyPhoneOtpRequest>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        if (isPhoneOtpMocked()) {
          const result = verifyMockOtp(arg.phoneNumber, arg.otp)
          if (!result.ok) {
            // Shaped as a FetchBaseQueryError carrying the API's error envelope,
            // so getApiErrorMessage renders it exactly like a real 400.
            return {
              error: {
                status: 400,
                data: { success: false, message: result.message },
              },
            }
          }
          return { data: result.session }
        }

        const result = await baseQuery({ url: '/auth/verify-phone-otp', method: 'POST', body: arg })
        if (result.error) return { error: result.error }
        return { data: (result.data as ApiEnvelope<Session>).data }
      },
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        // See the note on signin: catch the rejection or a wrong OTP becomes an
        // unhandled rejection. The component shows the error from `error`.
        try {
          const { data } = await queryFulfilled
          dispatch(credentialsReceived(data))
        } catch {
          // Handled by the component.
        }
      },
    }),

    /** Resend is the same operation as request — a new code replaces the old. */
    resendPhoneOtp: builder.mutation<SigninPhoneResponse, SigninPhoneRequest>({
      queryFn: async (arg, _api, _extra, baseQuery) => {
        if (isPhoneOtpMocked()) return { data: issueMockOtp(arg.phoneNumber) }

        const result = await baseQuery({ url: '/auth/resend-phone-otp', method: 'POST', body: arg })
        if (result.error) return { error: result.error }
        return { data: (result.data as ApiEnvelope<SigninPhoneResponse>).data }
      },
    }),

    /**
     * Exchanges the OAuth redirect tokens for an app session. Same shape as
     * signin, so it dispatches credentialsReceived the same way — the callback
     * page just navigates on success.
     */
    oauthComplete: builder.mutation<Session, OAuthCompleteRequest>({
      query: (body) => ({ url: '/auth/oauth/complete', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Session>) => r.data,
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        // See the note on signin. The callback page shows the error from `error`.
        try {
          const { data } = await queryFulfilled
          dispatch(credentialsReceived(data))
        } catch {
          // Handled by the callback page.
        }
      },
    }),

    logout: builder.mutation<void, void>({
      query: () => ({ url: '/auth/logout', method: 'POST' }),
      onQueryStarted: async (_arg, { dispatch, queryFulfilled }) => {
        // Clear local state in `finally` — whether or not the server call
        // succeeds. A network failure on logout must still sign the user out
        // locally, and the try/catch also stops that failure becoming an
        // unhandled rejection. The goal state is "signed out"; get there either
        // way.
        try {
          await queryFulfilled
        } catch {
          // The server-side revoke failed, but we still clear locally below.
        } finally {
          dispatch(loggedOut())
          // Drop every cached response — the next user must not read this one's.
          dispatch(baseApi.util.resetApiState())
        }
      },
    }),
  }),
})

export const {
  useSessionQuery,
  useSignupMutation,
  useSigninMutation,
  useSigninPhoneMutation,
  useVerifyPhoneOtpMutation,
  useResendPhoneOtpMutation,
  useOauthCompleteMutation,
  useLogoutMutation,
} = authApi
