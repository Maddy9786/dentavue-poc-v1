/**
 * Shared API contract types.
 *
 * Every DentaVue backend response — success and error alike — uses the same
 * envelope, per DentaVue_API_Endpoints.md. RTK Query endpoints unwrap `data`
 * via `transformResponse` so components never see the envelope.
 */

export interface ApiEnvelope<T> {
  success: true
  message: string
  data: T
}

export interface ApiErrorEnvelope {
  success: false
  message: string
  /** Field-level validation failures, keyed by field name (422 responses). */
  errors?: Record<string, string[]>
}

/** The two personas every model and endpoint is scoped by. */
export type UserType = 'patient' | 'provider'

/**
 * IDs are plain UUIDs, exactly as the database stores them.
 *
 * The API spec shows prefixed strings (`user_12345`, `clinic_12345`) — that is
 * a sketch, not a contract, and the decision has gone the other way. `profiles`
 * takes its primary key as a foreign key onto Supabase's `auth.users(id)`,
 * which is a uuid we do not control, so the alternative was to prefix on the
 * way out and strip on the way in at every boundary: a conversion that can only
 * ever be forgotten somewhere. What is in the database is what goes on the wire.
 *
 * Still branded, for a reason that survives the format change: `UserId` and
 * `ClinicId` are both uuid strings, so nothing but the type system stops one
 * being passed where the other is expected. The brand is erased at runtime.
 */
export type Id<TEntity extends string> = string & { readonly __brand: TEntity }

export type UserId = Id<'user'>
export type ClinicId = Id<'clinic'>
export type AppointmentId = Id<'appointment'>
export type AvailabilityId = Id<'availability'>

/** ISO-8601 UTC instant, e.g. `2024-07-15T10:30:00Z`. */
export type IsoDateTime = string
/** Calendar date, e.g. `2024-08-20`. Scheduling models split date from time. */
export type IsoDate = string
/** Wall-clock time, e.g. `09:00`. */
export type IsoTime = string

export interface Paginated<T> {
  items: T[]
  page: number
  pageSize: number
  total: number
}
