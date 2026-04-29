-- Add lead_form_data JSONB column to clients for structured website form responses.
-- Stores: budget, timeline, referral, services, details, sms_consent, source_form.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS lead_form_data JSONB;
