import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react'
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query'
import { env } from '@/lib/env'
import type { RootState } from '@/store'

/**
 * Single RTK Query API instance. Feature slices attach their endpoints with
 * `baseApi.injectEndpoints(...)` rather than creating their own api — one
 * instance keeps the cache and tag invalidation coherent across features.
 */

const rawBaseQuery = fetchBaseQuery({
  baseUrl: env.apiBaseUrl,
  // Send the httpOnly refresh cookie the API sets, so POST /auth/session can
  // restore the session on load. The access token still rides as a Bearer header
  // (from memory, below); the cookie is only read by /auth/session.
  credentials: 'include',
  prepareHeaders: (headers, { getState }) => {
    const token = (getState() as RootState).auth.accessToken
    if (token) headers.set('Authorization', `Bearer ${token}`)
    return headers
  },
})

/**
 * Wraps the base query to refresh once on 401 and replay the original request.
 *
 * TODO: implement against POST /auth/refresh-token. Concurrent 401s must share
 * a single in-flight refresh rather than each firing their own, or the refresh
 * token gets rotated out from under the other requests.
 */
const baseQueryWithReauth: BaseQueryFn<
  string | FetchArgs,
  unknown,
  FetchBaseQueryError
> = async (args, api, extraOptions) => {
  return rawBaseQuery(args, api, extraOptions)
}

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: baseQueryWithReauth,
  tagTypes: [
    'Auth',
    'Profile',
    'ProviderProfile',
    'Scan',
    'Analysis',
    'Appointment',
    'Availability',
    'Clinic',
    'Service',
    'Payment',
    'Notification',
    'Review',
  ],
  endpoints: () => ({}),
})
