-- ============================================================
-- Migration 028: Wizard Reconnections — Jonathan Apr 14 2026
-- ============================================================
-- Decisions confirmed by Jonathan:
--   1. Pavers / Demo Container Haul-off → leave as-is (he added standalone in A&D)
--   2. Outdoor Kitchen / Appliance Cutout Labor → reconnect as "Countertop Appliance Cutout (Per Appliance)"
--   3. Outdoor Kitchen / Kitchen Rebar → re-add product ($11/stick)
--   4. Freestanding Wall / Freestanding Adhesive → use "Wall Cap Adhesive" instead
--   5. Pergola / Pergola Pine Package → re-add product ($64/SF, 41.5% markup)
--   6. Sod / Sod Demo Haul-off → already done in migration 027
--
-- Final step: re-run product_id injection across all active wizard calc_rules
--   so every rule is linked by UUID (rename-safe going forward).
-- ============================================================


-- ── 1. Re-add Kitchen Rebar product ─────────────────────────────

INSERT INTO products_services (
  name, description, material_cost, labor_cost,
  markup_percentage, unit, is_active, category_id
)
SELECT
  'Kitchen Rebar',
  'Rebar (#4) for CMU island — 1 stick per ~3 cells — $11.00/stick',
  11.00, 0.00, 0, 'stick', true,
  (SELECT id FROM service_categories WHERE name = 'Outdoor Kitchens v2' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM products_services WHERE name = 'Kitchen Rebar'
);


-- ── 2. Re-add Pergola Pine Package product ───────────────────────

INSERT INTO products_services (
  name, description, material_cost, labor_cost,
  markup_percentage, unit, is_active, category_id
)
SELECT
  'Pergola Pine Package',
  'Pergola/Pavilion v2 — Pine lumber, all-in rate (materials + labor)',
  64.00, 0.00, 41.5, 'SF', true,
  (SELECT id FROM service_categories WHERE name = 'Pergola/Pavilion v2' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM products_services WHERE name = 'Pergola Pine Package'
);


-- ── 3. Outdoor Kitchen calc_rules: rename Appliance Cutout Labor ─
-- "Appliance Cutout Labor" was renamed to
-- "Countertop Appliance Cutout (Per Appliance)" in the catalog.
-- Update the product_name snapshot in all Outdoor Kitchen wizard rules.

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN rule.value->>'product_name' = 'Appliance Cutout Labor'
        THEN rule.value
          || jsonb_build_object('product_name', 'Countertop Appliance Cutout (Per Appliance)')
      ELSE rule.value
    END
    ORDER BY rule.ordinality
  )
  FROM jsonb_array_elements(calc_rules) WITH ORDINALITY AS rule(value, ordinality)
)
WHERE category ILIKE '%Outdoor Kitchen%'
  AND is_active = true
  AND calc_rules::text ILIKE '%Appliance Cutout Labor%';


-- ── 4. Retaining Walls calc_rules: Freestanding Adhesive → Wall Cap Adhesive ─
-- Jonathan confirmed: use the existing "Wall Cap Adhesive" product
-- for freestanding walls instead of the now-deleted "Freestanding Adhesive".

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN rule.value->>'product_name' = 'Freestanding Adhesive'
        THEN rule.value
          || jsonb_build_object('product_name', 'Wall Cap Adhesive')
      ELSE rule.value
    END
    ORDER BY rule.ordinality
  )
  FROM jsonb_array_elements(calc_rules) WITH ORDINALITY AS rule(value, ordinality)
)
WHERE category ILIKE '%Retaining Wall%'
  AND is_active = true
  AND calc_rules::text ILIKE '%Freestanding Adhesive%';


-- ── 5. Re-run product_id injection across ALL active wizards ─────
-- Picks up newly re-added products + renamed product_names from above.
-- This is the same idempotent logic from migrations 026 & 027.

UPDATE estimate_templates et
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN ps.id IS NOT NULL
        THEN rule.value || jsonb_build_object('product_id', ps.id::text)
      ELSE rule.value
    END
    ORDER BY rule.ordinality
  )
  FROM jsonb_array_elements(et.calc_rules) WITH ORDINALITY AS rule(value, ordinality)
  LEFT JOIN products_services ps
    ON ps.name ILIKE (rule.value->>'product_name')
   AND ps.is_active = true
)
WHERE et.is_active = true;
