import { baseApi } from '@/services/api/baseApi'
import type { ApiEnvelope, UserId, UserType } from '@/types/api'

/**
 * Profile endpoints.
 *
 * `updateProfile` is what onboarding step 3 posts. It requires a session — the
 * backend reads the user id from the bearer token, never the body — which
 * sign-up now issues, so the call is authenticated by the time onboarding runs.
 * Not in the API spec (it stops before profile); this matches the backend's
 * designed PATCH /profile.
 */
export type Gender = 'male' | 'female' | 'other'

export interface UpdateProfileRequest {
  fullName: string
  age: number
  gender: Gender
  healthConditions: string[]
  oralGoals: string[]
}

export interface Profile {
  userId: UserId
  email: string | null
  userType: UserType
  firstName: string
  lastName: string
  phoneNumber: string | null
  age: number | null
  gender: Gender | null
  healthConditions: string[]
  oralGoals: string[]
  createdAt: string
}

export const profileApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    updateProfile: builder.mutation<Profile, UpdateProfileRequest>({
      query: (body) => ({ url: '/profile', method: 'PATCH', body }),
      transformResponse: (r: ApiEnvelope<Profile>) => r.data,
      invalidatesTags: ['Profile'],
    }),
  }),
})

export const { useUpdateProfileMutation } = profileApi
