-- Migration 048: Google Calendar OAuth storage
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS google_calendar_refresh_token text,
  ADD COLUMN IF NOT EXISTS google_calendar_connected_at  timestamptz;
