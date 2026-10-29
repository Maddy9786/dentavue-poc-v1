import { combineReducers } from '@reduxjs/toolkit'
import { baseApi } from '@/services/api/baseApi'
import authReducer from '@/features/auth/authSlice'
import scanDraftReducer from '@/features/scan/scanDraftSlice'

/**
 * Client-side state only. Server data lives in the RTK Query cache under
 * `api` — do not mirror fetched entities into slices. (Scans are fetched through
 * RTK Query, GET /scans — see scansApi / useScanComparison.) `scanDraft` is the
 * exception-that-proves-the-rule: it holds the IN-PROGRESS captured images (not
 * yet server data), so the results screen can show them regardless of upload.
 */
export const rootReducer = combineReducers({
  [baseApi.reducerPath]: baseApi.reducer,
  auth: authReducer,
  scanDraft: scanDraftReducer,
})

export type RootReducerState = ReturnType<typeof rootReducer>
