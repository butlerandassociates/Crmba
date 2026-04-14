-- ============================================================
-- Migration 029: Add "Repeat Client" lead source
-- ============================================================
-- Jonathan confirmed Apr 14, 2026:
--   Repeat customers get a new client record each time (Option A).
--   A "Repeat Client" lead source is needed so staff can attribute
--   returning customers correctly when registering them.
-- ============================================================

INSERT INTO public.lead_sources (name, is_active)
VALUES ('Repeat Client', true)
ON CONFLICT (name) DO NOTHING;
