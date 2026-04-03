-- ============================================================
-- Migration 008: Wizard 1 — Concrete (Driveways · Patios · Pool Decks)
-- Based on CRM_Wizard_Flow_Spec_v3.pdf (March 31, 2026)
-- ============================================================

-- ── 1. Ensure Concrete service category exists ───────────────

INSERT INTO service_categories (name, is_active)
VALUES ('Concrete', true)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Ensure scoop unit exists ──────────────────────────────

INSERT INTO units (name)
VALUES ('scoop'), ('stick'), ('flat'), ('SF'), ('load')
ON CONFLICT (name) DO NOTHING;

-- ── 3. Concrete products — all pre-markup rates ──────────────
-- markup_percentage = 50 → client price = (labor + material) × 1.50

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Concrete' LIMIT 1)
FROM (VALUES
  -- Base labor — varies by pour depth
  ('Concrete Labor 4 inch',
   'Concrete installation labor — 4-inch pour depth — $6.00/SF',
   0.00, 6.00, 'SF'),
  ('Concrete Labor 5 inch',
   'Concrete installation labor — 5-inch pour depth — $6.00/SF',
   0.00, 6.00, 'SF'),
  ('Concrete Labor 6 inch',
   'Concrete installation labor — 6-inch pour depth — $7.00/SF',
   0.00, 7.00, 'SF'),

  -- Material by pour depth (hardcoded per spec — avoids floating-point rounding)
  ('Concrete Material 4 inch',
   'Concrete mix and material for 4-inch pour depth — $2.58/SF',
   2.58, 0.00, 'SF'),
  ('Concrete Material 5 inch',
   'Concrete mix and material for 5-inch pour depth — $3.22/SF',
   3.22, 0.00, 'SF'),
  ('Concrete Material 6 inch',
   'Concrete mix and material for 6-inch pour depth — $3.87/SF',
   3.87, 0.00, 'SF'),

  -- Stamped finish upcharges (STACK on top of base — do not replace)
  ('Stamped Labor Upcharge',
   'Stamped concrete labor upcharge — +$1.75/SF on top of base labor',
   0.00, 1.75, 'SF'),
  ('Stamped Material Upcharge',
   'Stamped concrete material upcharge — +$2.50/SF on top of base material',
   2.50, 0.00, 'SF'),

  -- Gravel base — admin enters scoop count (~1 scoop per 80-100 SF at 4-inch depth)
  ('57 Stone Gravel',
   '57-stone gravel base — admin enters scoop count based on site; ~1 scoop per 80-100 SF',
   37.00, 0.00, 'scoop'),

  -- Reinforcement
  ('Rebar (Concrete)',
   'Rebar for driveway reinforcement — ~1 stick per 20-25 SF at 2-ft grid; admin enters actual count',
   11.00, 0.00, 'stick'),

  -- Site conditions
  ('Difficult Access Surcharge',
   'Backyard or confined-access labor surcharge — $1.00/SF',
   0.00, 1.00, 'SF'),
  ('Line Pump',
   'Concrete line pump — flat rate when truck cannot reach pour zone directly',
   650.00, 0.00, 'flat')
) AS p(name, description, material_cost, labor_cost, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 4. Concrete Wizard Template ──────────────────────────────
-- ⚠️  SAFE GUARD: This INSERT is skipped if a 'Concrete' template already exists.
--     If you built the Concrete wizard manually in the Admin UI, DO NOT run this migration.
--     Running it is safe (the WHERE NOT EXISTS will skip the insert), but unnecessary.

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Concrete Wizard',
  'Concrete',
  'Wizard for concrete driveways, patios, and pool decks. Handles base labor, depth-based material costs, stamped finish upcharges, 57-stone base, rebar, demo, difficult access, and line pump.',
  true,
  '[
    {
      "id": "step_project",
      "title": "Project Details",
      "fields": [
        {
          "id": "projectType",
          "type": "radio",
          "label": "Project Type",
          "required": true,
          "options": ["Driveway", "Patio", "Pool Deck"],
          "help_text": "Driveways auto-use rebar reinforcement. Patios and Pool Decks use wire mesh (rate TBD from Jonathan)."
        },
        {
          "id": "squareFootage",
          "type": "number",
          "label": "Square Footage (SF)",
          "required": true,
          "placeholder": "e.g. 820"
        }
      ]
    },
    {
      "id": "step_pour",
      "title": "Pour Depth & Finish",
      "fields": [
        {
          "id": "pourDepth",
          "type": "radio",
          "label": "Pour Depth",
          "required": true,
          "options": ["4\"", "5\"", "6\""],
          "help_text": "4\" = $2.58/SF material | 5\" = $3.22/SF | 6\" = $3.87/SF"
        },
        {
          "id": "finishType",
          "type": "radio",
          "label": "Finish Type",
          "required": true,
          "options": ["Broom", "Stamped"],
          "help_text": "Stamped ADDS +$2.50/SF material and +$1.75/SF labor on top of base rates."
        }
      ]
    },
    {
      "id": "step_rebar",
      "title": "Rebar Reinforcement",
      "conditional_on": { "field_id": "projectType", "value": "Driveway" },
      "fields": [
        {
          "id": "rebarSticks",
          "type": "number",
          "label": "Rebar sticks",
          "required": true,
          "placeholder": "e.g. 40",
          "help_text": "Reference: ~1 stick per 20-25 SF at 2-ft grid. Admin enters actual count."
        }
      ]
    },
    {
      "id": "step_base",
      "title": "Gravel Base",
      "fields": [
        {
          "id": "scoopCount",
          "type": "number",
          "label": "57-Stone scoops",
          "required": true,
          "placeholder": "e.g. 10",
          "help_text": "Reference: ~1 scoop per 80-100 SF at 4-inch depth. Admin enters actual count from site assessment."
        }
      ]
    },
    {
      "id": "step_site",
      "title": "Site Conditions",
      "fields": [
        {
          "id": "difficultAccess",
          "type": "radio",
          "label": "Backyard or difficult access?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Adds $1.00/SF labor surcharge on top of base labor."
        },
        {
          "id": "linePump",
          "type": "radio",
          "label": "Line pump required?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Required when truck cannot reach pour zone directly. Flat $650 material."
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Concrete Labor 4 inch",
      "description": "Concrete installation labor — 4-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "4\""
    },
    {
      "product_name": "Concrete Labor 5 inch",
      "description": "Concrete installation labor — 5-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "5\""
    },
    {
      "product_name": "Concrete Labor 6 inch",
      "description": "Concrete installation labor — 6-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "6\""
    },
    {
      "product_name": "Concrete Material 4 inch",
      "description": "Concrete material — 4-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "4\""
    },
    {
      "product_name": "Concrete Material 5 inch",
      "description": "Concrete material — 5-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "5\""
    },
    {
      "product_name": "Concrete Material 6 inch",
      "description": "Concrete material — 6-inch pour",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "6\""
    },
    {
      "product_name": "Stamped Labor Upcharge",
      "description": "Stamped finish labor upcharge — stacks on base labor",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "finishType",
      "conditional_value": "Stamped"
    },
    {
      "product_name": "Stamped Material Upcharge",
      "description": "Stamped finish material upcharge — stacks on base material",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "finishType",
      "conditional_value": "Stamped"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "57-stone gravel base",
      "formula": "scoopCount",
      "unit": "scoop"
    },
    {
      "product_name": "Rebar (Concrete)",
      "description": "Rebar reinforcement — driveways only",
      "formula": "rebarSticks",
      "unit": "stick",
      "conditional_field_id": "projectType",
      "conditional_value": "Driveway"
    },
    {
      "product_name": "Difficult Access Surcharge",
      "description": "Backyard/difficult access labor surcharge",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "difficultAccess",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Line Pump",
      "description": "Concrete line pump — flat rate",
      "formula": "1",
      "unit": "flat",
      "conditional_field_id": "linePump",
      "conditional_value": "Yes"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Concrete' AND is_active = true);
