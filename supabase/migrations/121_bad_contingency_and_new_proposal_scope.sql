-- ─────────────────────────────────────────────────────────────────────────────
-- BAD (Base, Aggregate & Disposal) rework — Jonathan's spec, confirmed Sep 6-7 2026.
--
-- Scope rule (Jonathan's exact instruction, Sep 7 2026, 5:42 PM):
-- "Go ahead and proceed with this but don't affect sold, active or completed jobs.
--  Make this for new proposals going forward if possible."
--
-- Implemented as a one-time cutover flag, not a live status check: `bad_rate` is
-- NULL on every estimate that already exists today (this migration never backfills
-- it) and is always set at creation time on every NEW estimate going forward
-- (see proposal-builder.tsx). App code branches purely on
-- `estimate.bad_rate IS NULL` (old formula, untouched forever) vs
-- `estimate.bad_rate IS NOT NULL` (new formula) — so existing proposals can never
-- be affected regardless of what status they later move through, and there is no
-- ambiguity about a prospect proposal "converting" to the new model later.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_bad_rate decimal(5,2) DEFAULT 1.50;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS bad_rate             decimal(5,2),            -- NULL = old proposal, keep old BAD/GP formula forever
  ADD COLUMN IF NOT EXISTS contingency_reserve  decimal(12,2) DEFAULT 0, -- = qualifying direct cost x bad_rate, new proposals only
  ADD COLUMN IF NOT EXISTS contingency_consumed decimal(12,2) DEFAULT 0, -- overrun costs charged during the job, entered later
  ADD COLUMN IF NOT EXISTS contingency_released decimal(12,2);           -- computed once at job close only, NULL until then
