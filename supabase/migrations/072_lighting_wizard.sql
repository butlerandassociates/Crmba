-- ============================================================
-- Migration 072: Lighting Wizard
-- Jonathan's spec May 21 2026:
--   Step 1: Up Lights qty, Ledge Light LED qty, Ground Lights qty
--   Step 2: Trenching for conduit? (Yes/No)
--   Step 3 (conditional): Trenching linear feet
--   Step 4: Low voltage wire? (Yes/No)
--   Step 5 (conditional): Wire rolls qty
--   Transformer: auto 1 per 10 lights (ceil)
-- ============================================================


-- ── 1. Service category ──────────────────────────────────────

INSERT INTO service_categories (name, is_active)
VALUES ('Lighting', true)
ON CONFLICT (name) DO NOTHING;


-- ── 2. Products ──────────────────────────────────────────────

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Lighting' LIMIT 1)
FROM (VALUES
  ('Up Light',
   'In-ground or surface mount up light fixture — $95.00 each',
   95.00, 0.00, 'each'),
  ('Ledge Light LED',
   'LED ledge / wall-wash light — $115.00 each',
   115.00, 0.00, 'each'),
  ('Ground Light',
   'Ground-mounted landscape light — $94.00 each',
   94.00, 0.00, 'each'),
  ('Trenching for Conduit',
   'Trench and install conduit for low-voltage lighting — $10.00/LF',
   10.00, 0.00, 'LF'),
  ('Low Voltage Wire (250'')',
   'Low voltage wire — 250 ft roll — $159.08 each',
   159.08, 0.00, 'each'),
  ('Transformer 150W',
   '150W low-voltage transformer — auto-calculated 1 per 10 lights — $410.00 each',
   410.00, 0.00, 'each')
) AS p(name, description, material_cost, labor_cost, unit)
ON CONFLICT (name) DO NOTHING;


-- ── 3. Wizard template ───────────────────────────────────────

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Lighting Wizard',
  'Lighting',
  'Wizard for landscape lighting. Calculates up lights, ledge lights, ground lights, optional trenching for conduit, optional low-voltage wire, and auto-calculated transformers (1 per 10 lights).',
  true,
  '[
    {
      "id": "step_lights",
      "title": "Choose Lights",
      "fields": [
        {
          "id": "upLightQty",
          "type": "number",
          "label": "Up Lights (qty)",
          "required": true,
          "placeholder": "e.g. 4",
          "help_text": "In-ground or surface mount up lights — $95 each"
        },
        {
          "id": "ledgeLightQty",
          "type": "number",
          "label": "Ledge Light LEDs (qty)",
          "required": true,
          "placeholder": "e.g. 0",
          "help_text": "LED ledge / wall-wash lights — $115 each"
        },
        {
          "id": "groundLightQty",
          "type": "number",
          "label": "Ground Lights (qty)",
          "required": true,
          "placeholder": "e.g. 6",
          "help_text": "Ground-mounted landscape lights — $94 each. Transformer auto-calculated: 1 per 10 total lights."
        }
      ]
    },
    {
      "id": "step_trenching",
      "title": "Trenching for Conduit",
      "fields": [
        {
          "id": "trenchingRequired",
          "type": "radio",
          "label": "Trenching for conduit required?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    },
    {
      "id": "step_trenching_details",
      "title": "Trenching Details",
      "conditional_on": { "field_id": "trenchingRequired", "value": "Yes" },
      "fields": [
        {
          "id": "trenchingLF",
          "type": "number",
          "label": "Trenching (linear feet)",
          "required": true,
          "placeholder": "e.g. 50",
          "help_text": "$10/LF — measure total run from transformer to furthest fixture"
        }
      ]
    },
    {
      "id": "step_wire",
      "title": "Low Voltage Wire",
      "fields": [
        {
          "id": "wireRequired",
          "type": "radio",
          "label": "Low voltage wire required?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    },
    {
      "id": "step_wire_details",
      "title": "Wire Details",
      "conditional_on": { "field_id": "wireRequired", "value": "Yes" },
      "fields": [
        {
          "id": "wireRolls",
          "type": "number",
          "label": "Wire rolls (qty)",
          "required": true,
          "placeholder": "e.g. 1",
          "help_text": "Each roll = 250 ft of low-voltage wire — $159.08/roll"
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Up Light",
      "description": "Up light fixtures",
      "formula": "upLightQty",
      "unit": "each"
    },
    {
      "product_name": "Ledge Light LED",
      "description": "LED ledge / wall-wash light fixtures",
      "formula": "ledgeLightQty",
      "unit": "each"
    },
    {
      "product_name": "Ground Light",
      "description": "Ground-mounted landscape light fixtures",
      "formula": "groundLightQty",
      "unit": "each"
    },
    {
      "product_name": "Trenching for Conduit",
      "description": "Trench and install conduit for low-voltage wiring",
      "formula": "trenchingLF",
      "unit": "LF",
      "conditional_field_id": "trenchingRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Low Voltage Wire (250'')",
      "description": "250 ft rolls of low-voltage wire",
      "formula": "wireRolls",
      "unit": "each",
      "conditional_field_id": "wireRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Transformer 150W",
      "description": "150W transformer — auto-calculated 1 per 10 lights (ceiling)",
      "formula": "Math.ceil((upLightQty + ledgeLightQty + groundLightQty) / 10)",
      "unit": "each"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Lighting' AND is_active = true);


-- ── 4. Inject product_ids into the new template's calc_rules ─
-- Same idempotent pattern used in migrations 026, 027, 028.

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
WHERE et.category = 'Lighting'
  AND et.is_active = true;
