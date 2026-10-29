-- 0001_profiles
--
-- The one table the auth code needs. Until this exists, sign-up creates the
-- Supabase identity, fails to insert the profile, rolls the identity back, and
-- returns a 500 — so attaching a Supabase project without running this looks
-- like the API is broken rather than like a missing table.
--
-- No migration tool is chosen yet (see README.md), so this is plain SQL: paste
-- it into the Supabase SQL editor, or run it via psql against DATABASE_URL.
-- Whichever runner is adopted later can adopt this file as its first migration.
--
-- Identity lives in Supabase's managed auth.users. This table shares its
-- primary key and holds everything the product knows about a person.
-- Never write to auth.users directly.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,

  -- Mirrors auth.users.email. Null for phone-only sign-ups, which have no
  -- address until onboarding asks for one.
  email text,

  user_type text not null check (user_type in ('patient', 'provider')),

  -- Empty until onboarding completes. The default is load-bearing:
  -- /auth/verify-phone-otp registers an unknown number on the spot and inserts
  -- this row before any name is known. Make these not-null without a default
  -- and first-time phone sign-in fails.
  first_name text not null default '',
  last_name  text not null default '',

  -- E.164.
  phone_number text,

  created_at timestamptz not null default now()
);

-- Sign-in reads the row by id (the primary key, already indexed). This covers
-- the other direction — looking a person up by number, which onboarding and
-- support tooling will both want.
create index if not exists profiles_phone_number_idx
  on public.profiles (phone_number)
  where phone_number is not null;

-- RLS is NOT what protects this data: the backend connects with the
-- service-role key, which bypasses it entirely. Authorization is the service
-- layer's job. Enable it anyway — the anon key is a legitimate client of
-- Supabase Auth in this design, so it can reach PostgREST, and default-deny
-- means a leaked anon key reads nothing.
alter table public.profiles enable row level security;

-- Deliberately select-only, and only your own row. There is no insert/update
-- policy because no client should ever write here directly — the API does,
-- through the service-role key, which ignores these policies anyway.
drop policy if exists "own profile readable" on public.profiles;
create policy "own profile readable" on public.profiles
  for select
  using (auth.uid() = id);
