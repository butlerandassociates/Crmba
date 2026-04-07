-- ============================================================
-- Migration 019: A&D category, Outdoor Kitchens fix, delivery override
-- April 2026 — Jonathan confirmed
--
-- Changes:
--   1. Create "Access & Demolition" service category
--   2. Create "Demo Concrete (To Replace With Something New)" $3/SF labor
--   3. Add Appliances + Cutouts to Outdoor Kitchens v2 calc_rules
--   4. Add deliveryLoadsOverride field to Pavers, Retaining Walls,
--      Outdoor Kitchens v2 wizards (editable delivery load count)
-- ============================================================


-- ── 1. Access & Demolition category ────────────────────────────

INSERT INTO service_categories (name, is_active)
VALUES ('Access & Demolition', true)
ON CONFLICT (name) DO NOTHING;


-- ── 2. Demo Concrete product in A&D ────────────────────────────

INSERT INTO products_services (
  name, description, material_cost, labor_cost,
  markup_percentage, unit, is_active, category_id
)
SELECT
  'Demo Concrete (To Replace With Something New)',
  'Concrete demolition labor — $3.00/SF pre-markup. Used when replacing existing concrete.',
  0.00, 3.00, 50, 'SF', true,
  (SELECT id FROM service_categories WHERE name = 'Access & Demolition' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM products_services
  WHERE name = 'Demo Concrete (To Replace With Something New)'
);

-- Line Pump also lives in A&D (Jonathan: exists in wizard AND A&D)
INSERT INTO products_services (
  name, description, material_cost, labor_cost,
  markup_percentage, unit, is_active, category_id
)
SELECT
  'Line Pump (A&D)',
  'Concrete line pump — flat rate $650 material. Required when truck cannot reach pour zone.',
  650.00, 0.00, 50, 'flat', true,
  (SELECT id FROM service_categories WHERE name = 'Access & Demolition' LIMIT 1)
WHERE NOT EXISTS (
  SELECT 1 FROM products_services WHERE name = 'Line Pump (A&D)'
);


-- ── 3. Outdoor Kitchens v2 — add Appliances + Cutouts ──────────

UPDATE public.estimate_templates
SET calc_rules = calc_rules || '[
  {
    "product_name": "Appliance Installation Labor",
    "description": "Install outdoor kitchen appliances — $125/each labor",
    "formula": "applianceCount",
    "unit": "each"
  },
  {
    "product_name": "Appliance Cutout Labor",
    "description": "Cutouts for appliance installation — $35/each labor",
    "formula": "cutoutCount",
    "unit": "each"
  }
]'::jsonb
WHERE category = 'Outdoor Kitchens v2'
  AND is_active = true
  AND calc_rules::text NOT LIKE '%applianceCount%';

-- Add applianceCount + cutoutCount fields to Outdoor Kitchens v2 wizard steps
UPDATE public.estimate_templates
SET steps = steps || '[
  {
    "id": "step_appliances",
    "title": "Appliances",
    "fields": [
      {
        "id": "applianceCount",
        "type": "number",
        "label": "Number of Appliances",
        "required": true,
        "placeholder": "e.g. 3",
        "help_text": "Count all appliances: grill, fridge, side burner, sink, pizza oven, etc. $125/each labor."
      },
      {
        "id": "cutoutCount",
        "type": "number",
        "label": "Number of Cutouts",
        "required": true,
        "placeholder": "e.g. 3",
        "help_text": "Typically equals appliance count. $35/each labor."
      }
    ]
  }
]'::jsonb
WHERE category = 'Outdoor Kitchens v2'
  AND is_active = true
  AND steps::text NOT LIKE '%applianceCount%';


-- ── 4. Add deliveryLoadsOverride field to wizard site steps ─────

-- Pavers: add to step_site
UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step->>'id' = 'step_site'
        THEN jsonb_set(
          step,
          '{fields}',
          (step->'fields') || '[
            {
              "id": "deliveryLoadsOverride",
              "type": "number",
              "label": "Delivery Loads (optional override)",
              "required": false,
              "placeholder": "Leave blank to auto-calculate",
              "help_text": "System auto-calculates delivery loads. Enter a number here only if you need to override it."
            }
          ]'::jsonb
        )
      ELSE step
    END
  )
  FROM jsonb_array_elements(steps) AS step
)
WHERE category = 'Pavers'
  AND is_active = true
  AND steps::text NOT LIKE '%deliveryLoadsOverride%';

-- Retaining Walls: add to step_site
UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step->>'id' = 'step_site'
        THEN jsonb_set(
          step,
          '{fields}',
          (step->'fields') || '[
            {
              "id": "deliveryLoadsOverride",
              "type": "number",
              "label": "Delivery Loads (optional override)",
              "required": false,
              "placeholder": "Leave blank to auto-calculate",
              "help_text": "System auto-calculates delivery loads. Enter a number here only if you need to override it."
            }
          ]'::jsonb
        )
      ELSE step
    END
  )
  FROM jsonb_array_elements(steps) AS step
)
WHERE category = 'Retaining Walls'
  AND is_active = true
  AND steps::text NOT LIKE '%deliveryLoadsOverride%';

-- Outdoor Kitchens v2: add to step_appliances (added above)
UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step->>'id' = 'step_appliances'
        THEN jsonb_set(
          step,
          '{fields}',
          (step->'fields') || '[
            {
              "id": "deliveryLoadsOverride",
              "type": "number",
              "label": "Delivery Loads (optional override)",
              "required": false,
              "placeholder": "Leave blank to auto-calculate",
              "help_text": "System auto-calculates delivery loads. Enter a number here only if you need to override it."
            }
          ]'::jsonb
        )
      ELSE step
    END
  )
  FROM jsonb_array_elements(steps) AS step
)
WHERE category = 'Outdoor Kitchens v2'
  AND is_active = true
  AND steps::text NOT LIKE '%deliveryLoadsOverride%';
