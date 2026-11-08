/** Shared domain vocabulary. Mirrors src/types/api.ts in DentaVue-Web. */

/**
 * Every ID is a plain UUID, on the wire and in the database.
 *
 * The API spec shows prefixed strings (`user_12345`); that is a sketch and was
 * not adopted. `profiles.id` is a foreign key onto Supabase's `auth.users(id)`,
 * a uuid we do not own, so prefixing would mean encoding on every response and
 * decoding on every request — a step that only has to be missed once. Ship what
 * the database holds.
 */
export type Uuid = string

export type UserType = 'patient' | 'provider'

export type AppointmentStatus =
  | 'pending'
  | 'confirmed'
  | 'cancelled'
  | 'completed'
  | 'noShow'

export type AvailabilityType = 'recurring' | 'oneTime'

/** ISO-8601 UTC instant, e.g. `2024-07-15T10:30:00Z`. */
export type IsoDateTime = string
/** Calendar date, e.g. `2024-08-20`. */
export type IsoDate = string
/** Wall-clock time, e.g. `09:00`. */
export type IsoTime = string
