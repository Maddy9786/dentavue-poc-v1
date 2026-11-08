-- 0002_profile_onboarding
--
-- Columns onboarding step 3 ("Create your profile") collects: age, gender, and
-- the patient's self-reported health conditions and oral goals. Name is already
-- covered by first_name/last_name (0001); the "Full name" field is split into
-- those on write.
--
-- No migration tool is chosen yet (see README.md / 0001), so this is plain SQL:
-- paste it into the Supabase SQL editor, or run it via psql against DATABASE_URL.
--
-- All nullable / defaulted: a profile exists from sign-up (0001) long before
-- onboarding runs, and onboarding may be skipped, so none of these can be
-- required. Arrays default to empty so reads never see null lists.

alter table public.profiles
  add column if not exists age smallint check (age between 1 and 120),
  add column if not exists gender text check (gender in ('male', 'female', 'other')),
  add column if not exists health_conditions text[] not null default '{}',
  add column if not exists oral_goals text[] not null default '{}';
