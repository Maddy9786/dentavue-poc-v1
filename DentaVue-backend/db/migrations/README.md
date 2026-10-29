# Migrations

No migration tool is wired up yet — this is an open decision. The main options:

- **Supabase CLI** (`supabase migration new ...`) — native to the platform, handles local dev
  via Docker, and manages RLS policies alongside schema. The natural fit now that Supabase is
  also the auth provider.
- **A standalone runner** (node-pg-migrate, Kysely, Drizzle) against `DATABASE_URL` — works
  independently of Supabase tooling, better if the project may leave Supabase later.

Pick one before the first table is created; retrofitting migration history is painful.

`0001_profiles.sql` is plain SQL for exactly that reason — it runs in the Supabase SQL editor or
via `psql "$DATABASE_URL"` today, and whichever runner is adopted can take it as migration one.
**It is not applied automatically. Run it, or sign-up fails.**

## Schema expected by the current code

Identity lives in Supabase's managed `auth.users` — email, password hash, phone, sessions, OTP.
**Do not create a users table and do not write to `auth.users` directly.**

Everything the product needs about a person lives in `public.profiles`, sharing the same primary
key. `src/models/profile.model.ts` reads and writes it:

| Column | Type | Notes |
|---|---|---|
| `id` | uuid, PK | FK → `auth.users(id)` `ON DELETE CASCADE` |
| `email` | text, null | mirror of auth.users.email; null for phone-only signups |
| `user_type` | text, not null | `patient` \| `provider` |
| `first_name` | text, not null | `''` until onboarding completes |
| `last_name` | text, not null | `''` until onboarding completes |
| `phone_number` | text, null | E.164 |
| `created_at` | timestamptz, not null | default `now()` |

Columns are snake_case; the API contract is camelCase. The model owns that mapping.

Sketch:

```sql
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  user_type text not null check (user_type in ('patient','provider')),
  first_name text not null default '',
  last_name  text not null default '',
  phone_number text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
```

`first_name`/`last_name` default to `''` because phone sign-in creates the row before a name is
known — `/auth/verify-phone-otp` registers unknown numbers on the spot, and onboarding fills the
rest in. If you make them `not null` without a default, first-time phone sign-in fails.

## A note on RLS

The backend connects with the service-role key, which bypasses RLS, so RLS is not what protects
this data — the service layer is. Still enable it with default-deny policies on every table: it
costs nothing here and stops a leaked anon key becoming a full data breach.

`profiles` deserves policies even so, because the anon key is a legitimate client of Supabase Auth
in this design. A user should be able to read only their own row:

```sql
create policy "own profile readable" on public.profiles
  for select using (auth.uid() = id);
```
