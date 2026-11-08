import { supabaseAdmin } from '@/config/supabase.js'
import type { IsoDateTime, UserType } from '@/types/domain.js'

/**
 * The "M" in MVC: all database access for `public.profiles`.
 *
 * Supabase owns identity in `auth.users` — email, password, phone, sessions —
 * and that table must not be written to directly. Everything the product needs
 * about a person lives here instead, sharing the same primary key (a FK onto
 * auth.users.id with ON DELETE CASCADE, so deleting the identity removes this).
 *
 * There is deliberately no password_hash column: Supabase holds the credential.
 *
 * Models own persistence and nothing else — no business rules, no HTTP, no
 * authorization. Services compose models; controllers never import them.
 *
 * Rows are snake_case (Postgres convention); the API contract is camelCase.
 * That mapping is this layer's responsibility — see toDomain.
 */

export type Gender = 'male' | 'female' | 'other'

export interface ProfileRow {
  id: string
  email: string | null
  user_type: UserType
  first_name: string
  last_name: string
  phone_number: string | null
  age: number | null
  gender: Gender | null
  health_conditions: string[]
  oral_goals: string[]
  created_at: IsoDateTime
}

export interface Profile {
  userId: string
  email: string | null
  userType: UserType
  firstName: string
  lastName: string
  phoneNumber: string | null
  age: number | null
  gender: Gender | null
  healthConditions: string[]
  oralGoals: string[]
  createdAt: IsoDateTime
}

const TABLE = 'profiles'

function toDomain(row: ProfileRow): Profile {
  return {
    userId: row.id,
    email: row.email,
    userType: row.user_type,
    firstName: row.first_name,
    lastName: row.last_name,
    phoneNumber: row.phone_number,
    age: row.age,
    gender: row.gender,
    // Older rows created before 0002 (or PostgREST omitting an empty array)
    // read back as null; normalise to [] so callers never handle both.
    healthConditions: row.health_conditions ?? [],
    oralGoals: row.oral_goals ?? [],
    createdAt: row.created_at,
  }
}

export async function findById(userId: string): Promise<Profile | null> {
  const { data, error } = await supabaseAdmin.from(TABLE).select('*').eq('id', userId).maybeSingle()
  if (error) throw error
  return data ? toDomain(data as ProfileRow) : null
}

export async function create(input: {
  /** Must equal the auth.users id — this table shares its primary key. */
  userId: string
  email: string | null
  userType: UserType
  firstName: string
  lastName: string
  phoneNumber: string | null
}): Promise<Profile> {
  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .insert({
      id: input.userId,
      email: input.email,
      user_type: input.userType,
      first_name: input.firstName,
      last_name: input.lastName,
      phone_number: input.phoneNumber,
    })
    .select('*')
    .single()

  if (error) throw error
  return toDomain(data as ProfileRow)
}

/**
 * Updates the mutable profile fields for one user. Only the keys provided are
 * written (camelCase → snake_case here), so partial updates are safe. Identity
 * fields (id, email, user_type) are intentionally not updatable through here.
 */
export async function update(
  userId: string,
  fields: Partial<{
    firstName: string
    lastName: string
    phoneNumber: string | null
    age: number | null
    gender: Gender | null
    healthConditions: string[]
    oralGoals: string[]
  }>,
): Promise<Profile> {
  const patch: Record<string, unknown> = {}
  if (fields.firstName !== undefined) patch.first_name = fields.firstName
  if (fields.lastName !== undefined) patch.last_name = fields.lastName
  if (fields.phoneNumber !== undefined) patch.phone_number = fields.phoneNumber
  if (fields.age !== undefined) patch.age = fields.age
  if (fields.gender !== undefined) patch.gender = fields.gender
  if (fields.healthConditions !== undefined) patch.health_conditions = fields.healthConditions
  if (fields.oralGoals !== undefined) patch.oral_goals = fields.oralGoals

  const { data, error } = await supabaseAdmin
    .from(TABLE)
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single()

  if (error) throw error
  return toDomain(data as ProfileRow)
}
