-- Migration 116: stage_history table — tracks every pipeline stage change per client

CREATE TABLE IF NOT EXISTS public.stage_history (
  id          uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   uuid         NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  from_stage  text,        -- null for initial entry
  to_stage    text         NOT NULL,
  changed_at  timestamptz  NOT NULL DEFAULT now(),
  changed_by  uuid         REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_stage_history_client_id ON public.stage_history(client_id);
CREATE INDEX IF NOT EXISTS idx_stage_history_changed_at ON public.stage_history(changed_at);

ALTER TABLE public.stage_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stage_history_read"
  ON public.stage_history FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "stage_history_insert"
  ON public.stage_history FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');
