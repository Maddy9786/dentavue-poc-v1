import { baseApi } from '@/services/api/baseApi'
import type { ApiEnvelope } from '@/types/api'

/**
 * Scan endpoints — the backend saves captured images (Supabase Storage) and
 * returns them by signed URL. Not in the API spec (it stops before scans); this
 * matches the backend's designed POST/GET /scans.
 *
 * `uploadScan` is what the guided capture calls once all four angles are taken.
 * `getScans` is the display source (see useScanComparison), so scans survive a
 * reload once the session is restored.
 *
 * A scan is one session of up to four images; `imageUrl` is the cover (front
 * teeth) that Compare / AI-insight render — a short-lived signed URL, its
 * Supabase Storage host allowed in next.config `images.remotePatterns` so
 * ScanTile can render it. The other angles are stored server-side for a later
 * multi-image flow and are not returned here yet.
 */
/** One angle of a scan (front teeth → lower gums), with a signed image URL. */
export interface ScanImage {
  position: number
  angle: string
  imageUrl: string
}

export interface Scan {
  id: string
  /** The cover (front teeth) — what Compare / AI-insight render. */
  imageUrl: string
  /** Every angle in capture order — the scan-results carousel. */
  images: ScanImage[]
  capturedAt: string
  score: number | null
  createdAt: string
}

export interface UploadScanRequest {
  /** base64 image data URLs from the capture canvas, in capture order (front
   *  teeth first). The first is the cover the read paths render. */
  images: string[]
  /** ISO capture time; the backend stamps now() if omitted. */
  capturedAt?: string
}

export const scansApi = baseApi.injectEndpoints({
  endpoints: (builder) => ({
    getScans: builder.query<Scan[], void>({
      query: () => '/scans',
      transformResponse: (r: ApiEnvelope<Scan[]>) => r.data,
      providesTags: ['Scan'],
    }),
    uploadScan: builder.mutation<Scan, UploadScanRequest>({
      query: (body) => ({ url: '/scans', method: 'POST', body }),
      transformResponse: (r: ApiEnvelope<Scan>) => r.data,
      // Optimistically drop the just-captured image into the cached list so it
      // shows the instant "Done" is tapped — the data: URL renders directly
      // (ScanTile draws data URLs with <img>), no round-trip needed. The
      // invalidatesTags refetch then replaces it with the stored, signed-URL row.
      onQueryStarted: async (arg, { dispatch, queryFulfilled }) => {
        const provisional: Scan = {
          id: `pending-${crypto.randomUUID()}`,
          // Show the cover (first angle) immediately; the fetched row replaces it.
          imageUrl: arg.images[0] ?? '',
          // The captured data URLs stand in for the signed URLs until the refetch.
          images: arg.images.map((image, position) => ({
            position,
            angle: '',
            imageUrl: image,
          })),
          capturedAt: arg.capturedAt ?? new Date().toISOString(),
          score: null,
          createdAt: new Date().toISOString(),
        }
        const patch = dispatch(
          scansApi.util.updateQueryData('getScans', undefined, (draft) => {
            draft.push(provisional)
          }),
        )
        try {
          await queryFulfilled
        } catch {
          patch.undo()
        }
      },
      invalidatesTags: ['Scan'],
    }),
  }),
})

export const { useGetScansQuery, useUploadScanMutation } = scansApi
