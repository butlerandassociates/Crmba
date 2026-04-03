-- ============================================================
-- Migration 013: Fix Concrete Products — Existing DB
-- Jonathan confirmed (April 2026):
--   - Concrete Mix should be 3500 PSI, $190/CY material only (no labor on this line)
--   - Install Concrete (4") labor only — $7/SF, no material cost
--     ($3 material was a manual CY→SF breakdown — remove it)
--   - Install Concrete (6") labor only — $9/SF, no material cost (same fix)
--   - Concrete template calc_rules: update product_name reference 3000→3500 PSI
-- ============================================================

-- ── 1. Fix Concrete Mix — rename 3000→3500 PSI, remove labor_cost ─────────
-- The $7/SF labor belongs on the Install line, not per-CY here.

UPDATE public.products_services
SET
  name        = 'Concrete Mix (3500 PSI)',
  description = 'Ready-mix concrete (3500 PSI) — $190/CY pre-markup. Quantity in cubic yards.',
  labor_cost  = 0.00
WHERE name = 'Concrete Mix (3000 PSI)'
  AND is_active = true;


-- ── 2. Fix Install Concrete (4") — remove material_cost ───────────────────
-- $3/SF material was a CY→SF breakdown of $190/CY — not a real material line.
-- Labor $7/SF × 50% markup = $10.50/SF client price.
-- Also uncheck sales tax (no taxable material remains on this line).

UPDATE public.products_services
SET
  material_cost   = 0.00,
  sales_tax_rate  = NULL,
  description     = 'Concrete installation labor — 4-inch pour — $7.00/SF pre-markup'
WHERE id = '4c01b01f-0a5d-45bb-9e13-ddff824d2ba1';


-- ── 3. Fix Install Concrete (6") — same fix ───────────────────────────────

UPDATE public.products_services
SET
  material_cost   = 0.00,
  sales_tax_rate  = NULL,
  description     = 'Concrete installation labor — 6-inch pour — $9.00/SF pre-markup'
WHERE id = '43079f43-8708-4cfd-8b65-c33ff4494395';


-- ── 4. Update Concrete template calc_rules: 3000 PSI → 3500 PSI ───────────

UPDATE public.estimate_templates
SET calc_rules = REPLACE(calc_rules::text, 'Concrete Mix (3000 PSI)', 'Concrete Mix (3500 PSI)')::jsonb
WHERE category = 'Concrete'
  AND is_active = true;
