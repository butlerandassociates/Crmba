-- 038_intake_form.sql
-- Track Google Form intake submission per client

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS intake_form_completed     boolean       NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS intake_form_completed_at  timestamptz,
  ADD COLUMN IF NOT EXISTS intake_form_completed_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS intake_form_data          jsonb,
  ADD COLUMN IF NOT EXISTS intake_form_notes         text;

CREATE INDEX IF NOT EXISTS idx_clients_intake_form_completed ON public.clients(intake_form_completed);
