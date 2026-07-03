-- Migration 108: Office/Admin mileage trips
-- Lets a mileage trip be tagged as an internal "Office/Admin" trip (not tied to any
-- client). Distinguishes an intentional Office/Admin trip from an un-matched one
-- (both have null client_id/project_id). Safe to re-run.

ALTER TABLE public.mileage_trips
  ADD COLUMN IF NOT EXISTS is_office boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mileage_trips.is_office IS
  'True when the trip is an internal Office/Admin trip (no client). Shown as "Office/Admin" in the selector.';
