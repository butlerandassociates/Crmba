-- Migration 045: Lead source cleanup + external lead ID columns
-- Based on actual DB state as of Apr 19 2026.
-- Jonathan confirmed: clean up lead sources as needed.
-- ============================================================

-- 1. Add external lead ID columns for webhook deduplication
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS angi_lead_id     TEXT,
  ADD COLUMN IF NOT EXISTS callrail_call_id TEXT,
  ADD COLUMN IF NOT EXISTS meta_lead_id     TEXT;

CREATE INDEX IF NOT EXISTS idx_clients_angi_lead_id     ON public.clients (angi_lead_id)     WHERE angi_lead_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_callrail_call_id ON public.clients (callrail_call_id) WHERE callrail_call_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_meta_lead_id     ON public.clients (meta_lead_id)     WHERE meta_lead_id IS NOT NULL;

-- 2. Split "Instagram/Facebook" into two separate sources
--    Rename existing combined entry → "Facebook"
UPDATE public.lead_sources
SET name = 'Facebook'
WHERE id = '8f3dc05c-e4c5-4e1d-be2f-0e86326c1a8b';

--    Add "Instagram" as a new separate entry
INSERT INTO public.lead_sources (name, is_active)
VALUES ('Instagram', true)
ON CONFLICT (name) DO NOTHING;

-- 3. Add missing lead sources
INSERT INTO public.lead_sources (name, is_active)
VALUES
  ('Google Ads', true),  -- CallRail tracks separately from organic Google
  ('AI',         true)   -- exists on website form, was missing in DB
ON CONFLICT (name) DO NOTHING;

-- 4. Deactivate HomeAdvisor — Angi acquired them; form option maps to Angi
UPDATE public.lead_sources SET is_active = false
WHERE id = '42b3deda-a3c8-4e41-b6f1-3f1ef18b06c2';

-- 5. Deactivate "Call Tracking" — too vague, replaced by per-source CallRail tracking
--    Reassign any clients using it to "Website" as a safe fallback
UPDATE public.clients
SET lead_source_id = '2a025bb4-2c49-4fff-b60e-d3dbc00aee49'  -- Website
WHERE lead_source_id = '420d018a-0539-4de9-b023-186677657d66'; -- Call Tracking
UPDATE public.lead_sources SET is_active = false
WHERE id = '420d018a-0539-4de9-b023-186677657d66';
