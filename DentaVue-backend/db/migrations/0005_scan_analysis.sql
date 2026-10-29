-- 0005_scan_analysis
--
-- The AI layer's storage. See AI_INTEGRATION.md in the parent directory for the
-- design; the rule it exists to enforce is: THE MODEL OBSERVES, THE BACKEND
-- DECIDES. No score, band, badge or millimetre in this schema came out of the
-- model — the model supplies raw per-parameter severities (0-100) and boxes, and
-- src/services/scoring.ts derives everything else.
--
-- Three tables:
--   scan_analysis     one row per scan   — status, computed score, narrative
--   scan_parameters   six rows per scan  — raw severity + the band assigned
--   scan_annotations  0..n rows per scan — normalised boxes for the carousel
--
-- Plain SQL (no migration tool yet — see README). Run AFTER 0004, in the
-- Supabase SQL editor or via psql. NOT applied automatically.

-- ---------------------------------------------------------------------------
-- scan_analysis
-- ---------------------------------------------------------------------------
create table if not exists public.scan_analysis (
  -- One analysis per scan, so the scan's id IS the key. Re-analysis overwrites
  -- in place (upsert) rather than accumulating rows.
  scan_id uuid primary key references public.scans(id) on delete cascade,

  -- pending → the vision call is in flight (the analysing screen polls on this)
  -- ready   → every field below is populated
  -- failed  → the model or the pipeline errored; `error` says roughly why.
  -- A failed analysis never fails the upload: the scan stays viewable.
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  error text,

  -- Computed by scoring.ts, never by the model. Mirrors scans.score, which is
  -- kept in sync so the existing list endpoint needs no join.
  score smallint check (score between 0 and 100),
  -- 0-100. Derived from capture quality + the model's own per-parameter
  -- confidence + how many parameters it flagged uncertain.
  confidence smallint check (confidence between 0 and 100),
  -- True when confidence fell below the floor: the UI still shows bands and a
  -- score but suppresses deltas and trends rather than presenting noise.
  provisional boolean not null default false,

  -- Pass 2's output: findings[], monitor{}, actions[], insight{}. Written by a
  -- TEXT-ONLY call that is given the computed numbers, so the prose can never
  -- contradict them. Null while pending, or if only pass 1 succeeded.
  narrative jsonb,

  -- Reproducibility. All three change what a score MEANS, so a comparison
  -- across a version boundary is apples-to-oranges unless it is detectable.
  -- Because scoring.ts is pure and scan_parameters keeps the raw severities, a
  -- rubric change can be replayed over history without re-calling the model.
  model text,
  prompt_version text,
  rubric_version text,

  -- Observability without storing anything sensitive: never the images, never
  -- the key, never the raw response.
  latency_ms integer,
  input_tokens integer,
  output_tokens integer,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- scan_parameters
-- ---------------------------------------------------------------------------
-- Both numbers are stored on purpose. `severity` is the audit trail and the
-- input to a future re-score; `band` is what every screen actually renders, and
-- is what the NEXT scan's hysteresis compares against.
create table if not exists public.scan_parameters (
  scan_id uuid not null references public.scans(id) on delete cascade,
  -- One of the six in src/types/analysis.ts. Text rather than an enum so adding
  -- a parameter is a code change, not a migration.
  parameter text not null,
  -- Raw, exactly as the model returned it. NEVER read directly by a screen.
  severity smallint not null check (severity between 0 and 100),
  -- The model's own confidence in this reading, 0-100 (it reports 0-1).
  confidence smallint not null check (confidence between 0 and 100),
  -- Assigned by scoring.ts AFTER hysteresis against the previous scan, so it is
  -- not always the band `severity` alone would imply. That is the point.
  band text not null check (band in ('none', 'mild', 'moderate', 'marked')),
  primary key (scan_id, parameter)
);

-- ---------------------------------------------------------------------------
-- scan_annotations
-- ---------------------------------------------------------------------------
-- Regions the model localised, keyed per IMAGE so the results carousel overlays
-- the right frame. Coordinates are Gemini's native normalised 0-1000 space,
-- stored as-is: resolution-independent, so re-rendering at any display size is
-- a multiply, and no re-analysis is needed if the display size changes.
create table if not exists public.scan_annotations (
  id uuid primary key default gen_random_uuid(),
  scan_id uuid not null references public.scans(id) on delete cascade,
  -- Which of the four frames (0..3), matching scan_images.position.
  position smallint not null check (position between 0 and 3),
  -- Which parameter this region evidences, so the UI can colour/group it.
  parameter text not null,
  -- Normalised 0-1000, Gemini's [y_min, x_min, y_max, x_max] order.
  y_min smallint not null check (y_min between 0 and 1000),
  x_min smallint not null check (x_min between 0 and 1000),
  y_max smallint not null check (y_max between 0 and 1000),
  x_max smallint not null check (x_max between 0 and 1000),
  -- Short human-readable phrase, e.g. 'redness along gum margin'.
  label text not null,
  created_at timestamptz not null default now()
);

-- The common read: a scan's regions, grouped by frame.
create index if not exists scan_annotations_scan_idx
  on public.scan_annotations (scan_id, position);

-- ---------------------------------------------------------------------------
-- updated_at
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists scan_analysis_updated_at on public.scan_analysis;
create trigger scan_analysis_updated_at
  before update on public.scan_analysis
  for each row execute function public.set_updated_at();
