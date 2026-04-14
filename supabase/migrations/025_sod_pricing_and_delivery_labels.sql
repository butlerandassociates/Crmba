-- ============================================================
-- Migration 025: Fix sod product pricing + per-category delivery labels
-- Apr 14, 2026 — Jonathan confirmed:
--   • Grading: labor only $15/SF, $0 material
--   • Finish Grading: labor only $15/SF, $0 material
--   • Each wizard category needs its own delivery product name
-- ============================================================

-- ── 1. Fix Sod product pricing ────────────────────────────────

UPDATE products_services
SET material_cost = 0.00,
    labor_cost    = 15.00
WHERE name = 'Grading';

UPDATE products_services
SET material_cost = 0.00,
    labor_cost    = 15.00
WHERE name = 'Finish Grading';

-- ── 2. Add per-category delivery products ─────────────────────
-- "Wall Delivery" stays for Retaining Walls (already correct).
-- Pavers, Outdoor Kitchens, and Sod each get their own delivery product.

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 0, p.unit, true,
  (SELECT id FROM service_categories WHERE name = p.cat)
FROM (VALUES
  ('Paver Delivery',
   'Paver material delivery — $275.00/load (10 pallets per truck)',
   275.00, 0.00, 'Pavers', 'load'),
  ('Outdoor Kitchen Delivery',
   'Outdoor kitchen material delivery — $275.00/load (10 pallets per truck)',
   275.00, 0.00, 'Outdoor Kitchens', 'load'),
  ('Sod Delivery',
   'Sod material delivery — $275.00/load (flat charge)',
   275.00, 0.00, 'Sod', 'load')
) AS p(name, description, material_cost, labor_cost, cat, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 3. Update wizard calc_rules to use correct delivery name ──
-- Pavers wizard: Wall Delivery → Paver Delivery

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'product_name' = 'Wall Delivery'
      THEN jsonb_set(item, '{product_name}', '"Paver Delivery"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(calc_rules) AS item
)
WHERE category = 'Pavers';

-- Outdoor Kitchens wizard: Wall Delivery → Outdoor Kitchen Delivery

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'product_name' = 'Wall Delivery'
      THEN jsonb_set(item, '{product_name}', '"Outdoor Kitchen Delivery"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(calc_rules) AS item
)
WHERE category = 'Outdoor Kitchens';

-- Sod wizard: Wall Delivery → Sod Delivery

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN item->>'product_name' = 'Wall Delivery'
      THEN jsonb_set(item, '{product_name}', '"Sod Delivery"')
      ELSE item
    END
  )
  FROM jsonb_array_elements(calc_rules) AS item
)
WHERE category = 'Sod';
