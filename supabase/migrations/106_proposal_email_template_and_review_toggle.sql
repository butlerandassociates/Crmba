-- Migration 106: Global proposal email template + per-review email show toggle.
-- Jonathan Jun 10 2026: editable proposal email body in admin portal + control which reviews show.

-- Global proposal email template (editable in List Management)
ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS proposal_email_subject text,
  ADD COLUMN IF NOT EXISTS proposal_email_body    text;

COMMENT ON COLUMN public.company_settings.proposal_email_subject IS 'Global proposal email subject template. Supports {client_name}, {proposal_title}. Blank = default.';
COMMENT ON COLUMN public.company_settings.proposal_email_body    IS 'Global proposal email body template. Supports {client_first_name}. Blank = default.';

-- Per-review toggle: which reviews appear in the proposal email
ALTER TABLE public.proposal_reviews
  ADD COLUMN IF NOT EXISTS show_in_email boolean DEFAULT true;

COMMENT ON COLUMN public.proposal_reviews.show_in_email IS 'When true, this review may appear in the proposal email. Admin toggles this in List Management.';
