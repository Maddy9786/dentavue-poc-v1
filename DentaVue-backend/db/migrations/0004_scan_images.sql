-- 0004_scan_images
--
-- A guided scan is now FOUR framed images (front teeth, upper gums, tongue,
-- lower gums) captured in one session, not a single photo.
--
-- `public.scans` stays the session row, and `scans.storage_path` keeps holding
-- the FIRST image (front teeth) — the "cover" the app renders on Compare and
-- AI-insight today, so those read paths are unchanged. This table records every
-- image of the session, in capture order, so a later multi-image AI step (a
-- separate flow) can use all four angles.
--
-- Plain SQL (no migration tool yet — see README). Run it AFTER 0003, in the
-- Supabase SQL editor or via psql. NOT applied automatically.

create table if not exists public.scan_images (
  id uuid primary key default gen_random_uuid(),
  -- The session this frame belongs to; cascade so deleting the scan (or the
  -- account, which cascades to scans) removes its images.
  scan_id uuid not null references public.scans(id) on delete cascade,
  -- Capture order, 0..3. Position 0 is the front-teeth cover and mirrors
  -- scans.storage_path.
  position smallint not null check (position between 0 and 3),
  -- Which angle this frame is:
  -- 'front-teeth' | 'upper-gums' | 'tongue' | 'lower-gums'.
  angle text not null,
  -- Path within the `scans` bucket, e.g. '<userId>/<scanId>/<position>.jpg'.
  storage_path text not null,
  created_at timestamptz not null default now(),
  -- One frame per position within a session.
  unique (scan_id, position)
);

-- The common read: a session's frames in order.
create index if not exists scan_images_scan_idx
  on public.scan_images (scan_id, position);
