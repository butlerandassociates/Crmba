-- Migration 105: Move sales rep email template from per-appointment-type to global (company_settings).
-- Jonathan confirmed Jun 10 2026: one global default rep email template, not per-appointment-type.
-- The rep_email_subject/body columns on appointment_types are kept but ignored by the app going forward.

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS rep_email_subject text,
  ADD COLUMN IF NOT EXISTS rep_email_body    text;

COMMENT ON COLUMN public.company_settings.rep_email_subject IS 'Global sales rep appointment email subject template — sent on Initial Appointment scheduling. Supports {rep_name}, {client_name}, {date}, {time}, {type}. Blank = default.';
COMMENT ON COLUMN public.company_settings.rep_email_body    IS 'Global sales rep appointment email body template — sent on Initial Appointment scheduling. Supports {rep_name}, {client_name}, {date}, {time}, {type}, {address}, {phone}, {email}, {scope}. Blank = default.';
