import { createSlice, type PayloadAction } from '@reduxjs/toolkit'
import type { UserId, UserType } from '@/types/api'

/**
 * Auth session state.
 *
 * Tokens are held in memory only — they do not survive a reload. Persisting
 * them is an open decision: httpOnly cookies set by the backend are the safer
 * option and would let middleware.ts gate routes on the server. localStorage
 * would be simpler but is readable by any injected script.
 */

export interface AuthUser {
  userId: UserId
  email: string
  userType: UserType
  firstName: string
  lastName: string
  emailVerified: boolean
}

export interface AuthState {
  user: AuthUser | null
  accessToken: string | null
  refreshToken: string | null
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  refreshToken: null,
}

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    credentialsReceived: (
      state,
      action: PayloadAction<{ user: AuthUser; accessToken: string; refreshToken: string }>,
    ) => {
      state.user = action.payload.user
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    tokensRefreshed: (
      state,
      action: PayloadAction<{ accessToken: string; refreshToken: string }>,
    ) => {
      state.accessToken = action.payload.accessToken
      state.refreshToken = action.payload.refreshToken
    },
    loggedOut: () => initialState,
  },
  selectors: {
    selectCurrentUser: (state) => state.user,
    selectIsAuthenticated: (state) => state.accessToken !== null,
    selectUserType: (state) => state.user?.userType ?? null,
  },
})

export const { credentialsReceived, tokensRefreshed, loggedOut } = authSlice.actions
export const { selectCurrentUser, selectIsAuthenticated, selectUserType } = authSlice.selectors
export default authSlice.reducer
