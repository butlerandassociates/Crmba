-- ─────────────────────────────────────────────────────────────────────────────
-- Remaining scope from Jonathan's "Financials & Calculations" spec (confirmed
-- Sep 7-8 2026): commission include/exclude toggle, pricing_mode, PM labor
-- hours, and the internal-only burden/net fields. BAD/contingency (migration
-- 121) and the commission formula fix already shipped separately.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.company_settings
  ADD COLUMN IF NOT EXISTS default_pm_hourly_rate decimal(10,2) DEFAULT 0.00;

ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS commission_excluded  boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pricing_mode         text NOT NULL DEFAULT 'visibility'
    CHECK (pricing_mode IN ('visibility', 'burdened')),
  ADD COLUMN IF NOT EXISTS overhead_burden       decimal(12,2) DEFAULT 0,   -- internal only
  ADD COLUMN IF NOT EXISTS burdened_cost         decimal(12,2) DEFAULT 0,   -- internal only, direct_cost + overhead_burden
  ADD COLUMN IF NOT EXISTS net_gp                decimal(12,2) DEFAULT 0,   -- internal only
  ADD COLUMN IF NOT EXISTS net_margin_pct        decimal(5,2)  DEFAULT 0,   -- internal only
  ADD COLUMN IF NOT EXISTS net_after_commission  decimal(12,2) DEFAULT 0;   -- internal only

-- PM labor hours — mirrors field_installation_order_items' quantity x rate pattern.
-- hourly_rate is captured per line at entry time (not a live lookup) so a later change
-- to the company default rate never silently recomputes an already-saved proposal.
CREATE TABLE IF NOT EXISTS public.estimate_pm_labor_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id   uuid NOT NULL REFERENCES public.estimates(id) ON DELETE CASCADE,
  description   text NOT NULL DEFAULT '',
  hours         numeric(8,2) NOT NULL DEFAULT 0,
  hourly_rate   numeric(10,2) NOT NULL DEFAULT 0,
  total_cost    numeric(12,2) GENERATED ALWAYS AS (hours * hourly_rate) STORED,
  sort_order    int NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_estimate_pm_labor_estimate_id ON public.estimate_pm_labor_items(estimate_id);

ALTER TABLE public.estimate_pm_labor_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_all_estimate_pm_labor_items"
  ON public.estimate_pm_labor_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
-- Deliberately no anon grant — PM labor cost is internal-only, must never reach the
-- public proposal link. Also never joined into get_public_proposal (migration 120).
