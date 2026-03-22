-- Already executed manually in Supabase on 2026-03-22
-- Do not run again

ALTER TABLE public.clients
  ALTER COLUMN appointment_date TYPE timestamptz USING appointment_date::timestamptz,
  ADD COLUMN IF NOT EXISTS appointment_end_date timestamptz;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS end_time        time,
  ADD COLUMN IF NOT EXISTS appointment_type text,
  ADD COLUMN IF NOT EXISTS google_meet_link text,
  ADD COLUMN IF NOT EXISTS google_event_html_link text;

ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS is_met boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS met_at timestamptz;
