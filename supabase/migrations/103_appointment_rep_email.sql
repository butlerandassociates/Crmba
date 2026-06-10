-- ─────────────────────────────────────────────────────────────────────────────
-- Editable Sales Rep email template, per appointment type.
-- Parallel to the existing client-facing email_subject / email_body, this lets
-- admins edit the "field info" email that the assigned rep receives — managed
-- in List Management → Appointment Types, with the same add/edit/delete flow.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.appointment_types
  ADD COLUMN IF NOT EXISTS rep_email_subject text,
  ADD COLUMN IF NOT EXISTS rep_email_body    text;

COMMENT ON COLUMN public.appointment_types.rep_email_subject IS
  'Subject line for the sales-rep field-info email. Supports {client_name} {date} {time} {type} placeholders.';
COMMENT ON COLUMN public.appointment_types.rep_email_body IS
  'Message body for the sales-rep field-info email (branded layout + client info table added by the app). Supports {rep_name} {client_name} {date} {time} {type} {address} {phone} {email} {scope} placeholders.';
