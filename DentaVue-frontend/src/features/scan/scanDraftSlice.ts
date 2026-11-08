import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

/**
 * The just-captured guided-scan session, held in memory so the results screen can
 * show the four images the user took — regardless of auth or whether the backend
 * upload has landed yet.
 *
 * This is transient CLIENT capture state, not a mirror of fetched scans: the
 * persisted scans come from GET /scans (RTK Query). The results carousel prefers
 * this draft (the images from this session), and falls back to the fetched scans
 * on a later visit / after a reload (when the draft is gone).
 */
export interface ScanDraftState {
  /** data: URLs of the captured angles, in order. Empty when none this session. */
  images: string[]
  /**
   * The id the backend assigned this session, once POST /scans has resolved.
   *
   * This is what makes the analysing screen real rather than a timer: analysis
   * runs server-side after the upload responds, so the screen polls
   * GET /scans/:scanId/analysis until it is ready. Null while the upload is in
   * flight, when it failed, or when the user is signed out — the screen falls
   * back to a simulated run in every one of those cases.
   */
  scanId: string | null
}

const initialState: ScanDraftState = { images: [], scanId: null }

const scanDraftSlice = createSlice({
  name: 'scanDraft',
  initialState,
  reducers: {
    scanDraftCaptured: (state, action: PayloadAction<string[]>) => {
      state.images = action.payload
      // A new capture invalidates the previous session's id: the analysing
      // screen must never poll the PREVIOUS scan and report its result as this
      // one's — which is what would happen if this were left in place.
      state.scanId = null
    },
    scanDraftUploaded: (state, action: PayloadAction<string>) => {
      state.scanId = action.payload
    },
    scanDraftCleared: () => initialState,
  },
  selectors: {
    selectScanDraftImages: (state) => state.images,
    selectScanDraftId: (state) => state.scanId,
  },
})

export const { scanDraftCaptured, scanDraftUploaded, scanDraftCleared } = scanDraftSlice.actions
export const { selectScanDraftImages, selectScanDraftId } = scanDraftSlice.selectors
export default scanDraftSlice.reducer
