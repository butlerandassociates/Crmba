-- ============================================================
-- Migration 020: Fix A&D category + add Appliance Cutout Labor
-- April 2026 — run AFTER migration 019
--
-- Fixes:
--   1. "Demo Concrete (To Replace With Something New)" already exists
--      in the old Concrete v1 category — migration 019's INSERT was
--      skipped by WHERE NOT EXISTS. Move it to A&D.
--
--   2. "Appliance Cutout Labor" product is missing entirely.
--      Migration 019 adds calc_rules referencing this name for
--      Outdoor Kitchens v2 — without the product the price = $0.
--      Insert at $35/each labor, 50% markup.
-- ============================================================


-- ── 1. Move Demo Concrete to Access & Demolition ────────────────

UPDATE public.products_services
SET
  category_id = (
    SELECT id FROM public.service_categories
    WHERE name = 'Access & Demolition'
    LIMIT 1
  ),
  description = 'Concrete demolition labor — $3.00/SF pre-markup. Used when replacing existing concrete.'
WHERE name = 'Demo Concrete (To Replace With Something New)'
  AND category_id <> (
    SELECT id FROM public.service_categories
    WHERE name = 'Access & Demolition'
    LIMIT 1
  );


-- ── 2. Add Appliance Cutout Labor (missing product) ────────────

INSERT INTO public.products_services (
  name, description, material_cost, labor_cost,
  markup_percentage, unit, is_active, category_id
)
SELECT
  'Appliance Cutout Labor',
  'Cutout for appliance installation — $35.00/each labor',
  0.00, 35.00, 50, 'each', true,
  (
    SELECT id FROM public.service_categories
    WHERE name = 'Outdoor Kitchen'
    LIMIT 1
  )
WHERE NOT EXISTS (
  SELECT 1 FROM public.products_services
  WHERE name = 'Appliance Cutout Labor'
);
