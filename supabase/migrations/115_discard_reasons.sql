-- Migration 115: discard_reasons table + new structured discard columns on clients

-- ── 1. Create discard_reasons table ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.discard_reasons (
  id            uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  label         text         NOT NULL,
  sort_order    integer      NOT NULL DEFAULT 0,
  is_active     boolean      NOT NULL DEFAULT true,
  requires_note boolean      NOT NULL DEFAULT false,
  created_at    timestamptz  NOT NULL DEFAULT now()
);

ALTER TABLE public.discard_reasons ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read (needed for discard dialog dropdown)
CREATE POLICY "discard_reasons_read"
  ON public.discard_reasons FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only admins can add, edit, soft-delete
CREATE POLICY "discard_reasons_admin_write"
  ON public.discard_reasons FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ── 2. Seed 20 default reasons ──────────────────────────────────────────────
INSERT INTO public.discard_reasons (label, sort_order, requires_note) VALUES
  ('Outside our service area',             1,  false),
  ('Service we do not offer',              2,  false),
  ('Spam, bot, or wrong number',           3,  false),
  ('Duplicate lead',                       4,  false),
  ('Never reached after 5 attempts',       5,  false),
  ('Budget below our minimum',             6,  false),
  ('Renter or not the decision maker',     7,  false),
  ('Price shopping only, not serious',     8,  false),
  ('No-show at the appointment',           9,  false),
  ('Cancelled the appointment',            10, false),
  ('Rescheduled repeatedly, went cold',    11, false),
  ('Client went silent',                   12, false),
  ('Price — too expensive',                13, false),
  ('Chose a competitor',                   14, false),
  ('Timing — postponed to a later season', 15, false),
  ('Budget — could not fund it',           16, false),
  ('Project cancelled entirely',           17, false),
  ('Scope changed, no longer a fit',       18, false),
  ('We declined the job',                  19, false),
  ('Other',                                20, true)
ON CONFLICT DO NOTHING;

-- ── 3. Add structured discard columns to clients ────────────────────────────
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS discard_reason_id    uuid REFERENCES public.discard_reasons(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS discard_note         text,
  ADD COLUMN IF NOT EXISTS competitor_name      text,
  ADD COLUMN IF NOT EXISTS discarded_from_stage text;

CREATE INDEX IF NOT EXISTS idx_clients_discard_reason_id
  ON public.clients(discard_reason_id);
