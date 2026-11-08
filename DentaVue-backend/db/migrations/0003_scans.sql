-- 0003_scans
--
-- Stores the dental scans a signed-in patient captures. The image bytes live in
-- Supabase Storage (private bucket `scans`); this table holds one row per scan
-- with the object's path and metadata. The AI score is nullable — imaging
-- analysis isn't built yet, so it's filled in later.
--
-- No endpoint for this is in the API spec (it stops at #37 — see CLAUDE.md's
-- coverage gap); the scan module is designed, not transcribed. Flag for review.
--
-- No migration tool is chosen yet (see README.md), so this is plain SQL: paste
-- it into the Supabase SQL editor, or run it via psql against DATABASE_URL.
-- NOT applied automatically — run it, or POST /scans fails.

create table if not exists public.scans (
  id uuid primary key default gen_random_uuid(),
  -- FK onto Supabase's managed identity table, cascade so deleting the account
  -- removes their scans (the Storage objects are cleaned separately).
  user_id uuid not null references auth.users(id) on delete cascade,
  -- Path within the `scans` bucket, e.g. '<userId>/<scanId>.jpg'. Not a URL:
  -- the bucket is private, so the API signs a short-lived URL on read.
  storage_path text not null,
  captured_at timestamptz not null default now(),
  -- AI oral-health score (0–100), null until imaging analysis exists.
  score smallint check (score between 0 and 100),
  created_at timestamptz not null default now()
);

-- The common read: a user's scans, newest resolved cheaply.
create index if not exists scans_user_captured_idx
  on public.scans (user_id, captured_at desc);

-- Private bucket for the scan images. Private because scans are personal health
-- images: only the backend (service-role, which bypasses Storage RLS) writes and
-- reads them, handing the browser a signed URL. No public access, no Storage
-- policies needed while only the service role touches the bucket.
insert into storage.buckets (id, name, public)
values ('scans', 'scans', false)
on conflict (id) do nothing;
