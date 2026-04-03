-- ============================================================
-- Migration 009: v2 Wizard Templates for Jonathan Review
--   1. Pergola/Pavilion v2 (new category)
--   2. Outdoor Kitchens v2 (updated 7-step spec)
--   3. Retaining Walls (Gravity / CMU / Freestanding branching)
--   4. Concrete v2 (updated labor rates by depth)
--
-- Once Jonathan confirms each wizard:
--   → Run a follow-up migration to rename v2 → original category name
--   → Deactivate old wizard template for that category
-- ============================================================

-- ── 1. Service Categories ─────────────────────────────────────

INSERT INTO service_categories (name, is_active)
VALUES
  ('Pergola/Pavilion v2',    true),
  ('Outdoor Kitchens v2', true),
  ('Retaining Walls',  true)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Units (ensure all needed units exist) ──────────────────

INSERT INTO units (name)
VALUES ('SF'), ('LF'), ('each'), ('bag'), ('stick'), ('scoop'), ('pallet'), ('CY'), ('load'), ('tube')
ON CONFLICT (name) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PRODUCTS — PERGOLA / PAVILION
-- Markup: 41.5% (per spec)
-- All-in rates (material + labor bundled into material_cost)
-- ════════════════════════════════════════════════════════════

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT p.name, p.description, p.material_cost, p.labor_cost, p.markup, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Pergola/Pavilion v2')
FROM (VALUES
  ('Pergola Pine Package',
   'Pergola/Pavilion v2 — Pine lumber, all-in rate (materials + labor)',
   64.00, 0.00, 41.5, 'SF'),
  ('Pergola Cedar Package',
   'Pergola/Pavilion v2 — Cedar lumber, all-in rate (materials + labor)',
   74.00, 0.00, 41.5, 'SF')
) AS p(name, description, material_cost, labor_cost, markup, unit)
ON CONFLICT (name) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PRODUCTS — OUTDOOR KITCHENS v2
-- Markup: 50% on all items
-- ════════════════════════════════════════════════════════════

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Outdoor Kitchens v2')
FROM (VALUES
  ('Kitchen CMU Block',
   'CMU block (8×8×16) for outdoor kitchen island — $2.87/block',
   2.87, 0.00, 'each'),
  ('Kitchen Mortar 50lb',
   'Mortar 50lb bag — CMU wall + concrete base construction',
   8.00, 0.00, 'bag'),
  ('Kitchen Rebar',
   'Rebar (#4) for CMU island — 1 stick per ~3 cells',
   11.00, 0.00, 'stick'),
  ('Kitchen Base Labor',
   'Concrete base labor — Base SF = Island LF × 0.5 ft — $2.00/SF',
   0.00, 2.00, 'SF'),
  ('Brick Veneer Pallet',
   'Brick veneer pallets — 80 SF coverage per pallet — $205.00/pallet',
   205.00, 0.00, 'pallet'),
  ('Natural Stone Veneer',
   'Natural stone veneer material — $30.00/SF of face area',
   30.00, 0.00, 'SF'),
  ('Kitchen Build Labor',
   'Overall island build labor (CMU, base, veneer install) — $35.00/SF of face area',
   0.00, 35.00, 'SF'),
  ('Granite Countertop',
   'Granite countertop — $90.00/SF (style TBD by client)',
   90.00, 0.00, 'SF'),
  ('Concrete Countertop Mat',
   'Poured concrete countertop material — $3.00/SF',
   3.00, 0.00, 'SF'),
  ('Concrete Countertop Labor',
   'Poured concrete countertop labor — $6.00/SF',
   0.00, 6.00, 'SF')
) AS p(name, description, material_cost, labor_cost, unit)
ON CONFLICT (name) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- PRODUCTS — RETAINING WALLS v2
-- Markup: 50% on all items
-- ════════════════════════════════════════════════════════════

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Retaining Walls')
FROM (VALUES
  -- Gravity Wall (Belgard Highland Stone SRW)
  ('Highland Stone SRW Block',
   'Belgard Highland Stone SRW — 0.739 SF face per block — $8.20/block',
   8.20, 0.00, 'each'),
  ('Retaining Wall Backfill',
   'Backfill import — $35.00/CY',
   35.00, 0.00, 'CY'),
  ('Corrugated Drain Pipe',
   'Corrugated drainage pipe behind retaining wall — $35.00/LF',
   35.00, 0.00, 'LF'),
  ('Wall Delivery',
   'Block/material delivery — $275.00/load (10 pallets per truck)',
   275.00, 0.00, 'load'),
  ('Gravity Cap Block',
   'Gravity wall cap block — $5.50/each (17.75" wide per cap)',
   5.50, 0.00, 'each'),
  ('Gravity Cap Labor',
   'Install gravity wall cap blocks — $6.00/each',
   0.00, 6.00, 'each'),
  ('Wall Cap Adhesive',
   'Construction adhesive tubes for cap blocks — $9.00/tube (1 tube per 15 LF)',
   9.00, 0.00, 'tube'),
  ('Retaining Wall Labor Flat',
   'Retaining wall build labor — flat/easy access — $45.00/SF face',
   0.00, 45.00, 'SF'),
  ('Retaining Wall Labor Hard',
   'Retaining wall build labor — slope/difficult access — $55.00/SF face',
   0.00, 55.00, 'SF'),
  -- CMU Retaining Wall
  ('CMU Retaining Block',
   'CMU block (8×8×16) for retaining wall — $2.87/block',
   2.87, 0.00, 'each'),
  ('Retaining Mortar 50lb',
   'Mortar 50lb bag for CMU retaining wall — approx LF ÷ 20 bags',
   8.00, 0.00, 'bag'),
  ('Retaining Rebar',
   'Rebar (#4) for CMU retaining wall — 1 stick per ~3 cells',
   11.00, 0.00, 'stick'),
  -- Freestanding Wall (Belgard Weston Stone)
  ('Weston Stone',
   'Belgard Weston Stone freestanding wall block — $6.50/SF',
   6.50, 0.00, 'SF'),
  ('Freestanding Adhesive',
   'Construction adhesive for freestanding wall — $9.00/tube (1 tube per 15 LF)',
   9.00, 0.00, 'tube'),
  ('Freestanding Cap Block',
   'Freestanding wall cap block — $3.50/each (12" wide per cap)',
   3.50, 0.00, 'each'),
  ('Freestanding Cap Labor',
   'Install freestanding wall cap blocks — $4.00/each',
   0.00, 4.00, 'each'),
  ('Freestanding Labor Flat',
   'Freestanding wall build labor — flat/easy access — $20.00/SF face',
   0.00, 20.00, 'SF'),
  ('Freestanding Labor Hard',
   'Freestanding wall build labor — slope/difficult access — $30.00/SF face',
   0.00, 30.00, 'SF'),
  -- Shared (demo applies to all wall types)
  ('Wall Demo Labor',
   'Demo existing wall/footing — $6.00/LF',
   0.00, 6.00, 'LF')
) AS p(name, description, material_cost, labor_cost, unit)
ON CONFLICT (name) DO NOTHING;


-- ════════════════════════════════════════════════════════════
-- WIZARD 1 — PERGOLA / PAVILION
-- ════════════════════════════════════════════════════════════

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Pergola/Pavilion v2 Wizard',
  'Pergola/Pavilion v2',
  'Wizard for pergola and pavilion structures. Pine at $64/SF, Cedar at $74/SF all-in. Markup 41.5%. Roof type captured for proposal notes only.',
  true,
  '[
    {
      "id": "step_dimensions",
      "title": "Dimensions",
      "fields": [
        {
          "id": "pergLength",
          "type": "number",
          "label": "Length (ft)",
          "required": true,
          "placeholder": "e.g. 16"
        },
        {
          "id": "pergWidth",
          "type": "number",
          "label": "Width (ft)",
          "required": true,
          "placeholder": "e.g. 14"
        },
        {
          "id": "pergHeight",
          "type": "number",
          "label": "Height (ft)",
          "required": true,
          "placeholder": "e.g. 10",
          "help_text": "Captured for proposal scope notes only — does not affect pricing."
        }
      ]
    },
    {
      "id": "step_wood",
      "title": "Wood Type",
      "fields": [
        {
          "id": "woodType",
          "type": "radio",
          "label": "Select Wood Type",
          "required": true,
          "options": ["Pine", "Cedar"]
        }
      ]
    },
    {
      "id": "step_roof",
      "title": "Roof Type",
      "fields": [
        {
          "id": "roofType",
          "type": "radio",
          "label": "Select Roof Type",
          "required": true,
          "options": ["Shingled", "Metal"]
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Pergola Pine Package",
      "description": "Pergola/Pavilion v2 — Pine",
      "formula": "pergLength * pergWidth",
      "unit": "SF",
      "conditional_field_id": "woodType",
      "conditional_value": "Pine"
    },
    {
      "product_name": "Pergola Cedar Package",
      "description": "Pergola/Pavilion v2 — Cedar",
      "formula": "pergLength * pergWidth",
      "unit": "SF",
      "conditional_field_id": "woodType",
      "conditional_value": "Cedar"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Pergola/Pavilion v2' AND is_active = true);


-- ════════════════════════════════════════════════════════════
-- WIZARD 2 — OUTDOOR KITCHENS v2
-- ════════════════════════════════════════════════════════════

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Outdoor Kitchens Wizard v2',
  'Outdoor Kitchens v2',
  'Updated outdoor kitchen wizard. CMU block structure auto-calculated from dimensions. Veneer options: Brick, Natural Stone, None. Countertop: Granite or Poured Concrete. Overall labor $35/SF face area.',
  true,
  '[
    {
      "id": "step_type",
      "title": "Structure Type",
      "fields": [
        {
          "id": "structureType",
          "type": "radio",
          "label": "Structure Type",
          "required": true,
          "options": ["CMU Block (Custom Masonry)"],
          "help_text": "CMU block masonry is the current standard build."
        }
      ]
    },
    {
      "id": "step_dimensions",
      "title": "Island Dimensions",
      "fields": [
        {
          "id": "islandConfig",
          "type": "radio",
          "label": "Island Configuration (reference only)",
          "required": true,
          "options": ["Single Island", "L-Shape", "U-Shape", "Custom"],
          "help_text": "Reference only — does not affect pricing. All pricing based on linear feet."
        },
        {
          "id": "islandLF",
          "type": "number",
          "label": "Total Island Linear Feet (LF)",
          "required": true,
          "placeholder": "e.g. 12",
          "help_text": "Total perimeter of all island runs."
        },
        {
          "id": "islandHeightIn",
          "type": "radio",
          "label": "Island Height (inches)",
          "required": true,
          "options": ["36", "42", "48"],
          "help_text": "36\" = standard counter height | 42\" = bar height | 48\" = high bar"
        }
      ]
    },
    {
      "id": "step_veneer",
      "title": "Veneer / Exterior Finish",
      "fields": [
        {
          "id": "veneerType",
          "type": "radio",
          "label": "Veneer Type",
          "required": true,
          "options": ["Brick Veneer", "Natural Stone Veneer", "None / Paint-Grade CMU"]
        }
      ]
    },
    {
      "id": "step_countertop",
      "title": "Countertop",
      "fields": [
        {
          "id": "countertopType",
          "type": "radio",
          "label": "Countertop Type",
          "required": true,
          "options": ["Granite", "Poured Concrete"]
        },
        {
          "id": "countertopSF",
          "type": "number",
          "label": "Countertop Square Footage (SF)",
          "required": true,
          "placeholder": "e.g. 24",
          "help_text": "Measure countertop area separately — not assumed from island footprint."
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Kitchen CMU Block",
      "description": "CMU blocks (8×8×16) — Face SF ÷ 0.89 block face area + 5% waste",
      "formula": "Math.ceil((islandLF * (islandHeightIn / 12)) / 0.89 * 1.05)",
      "unit": "each"
    },
    {
      "product_name": "Kitchen Mortar 50lb",
      "description": "Mortar — CMU wall + concrete base (2× LF ÷ 20 bags)",
      "formula": "2 * Math.ceil(islandLF / 20)",
      "unit": "bag"
    },
    {
      "product_name": "Kitchen Rebar",
      "description": "Rebar (#4) — 1 stick per cell, cells = block count ÷ 3",
      "formula": "Math.ceil(Math.ceil((islandLF * (islandHeightIn / 12)) / 0.89) / 3)",
      "unit": "stick"
    },
    {
      "product_name": "Kitchen Base Labor",
      "description": "Concrete base labor — Base SF = Island LF × 0.5",
      "formula": "islandLF * 0.5",
      "unit": "SF"
    },
    {
      "product_name": "Brick Veneer Pallet",
      "description": "Brick veneer — Face SF ÷ 80 SF per pallet",
      "formula": "Math.ceil((islandLF * (islandHeightIn / 12)) / 80)",
      "unit": "pallet",
      "conditional_field_id": "veneerType",
      "conditional_value": "Brick Veneer"
    },
    {
      "product_name": "Kitchen Mortar 50lb",
      "description": "Mortar — brick veneer (LF ÷ 20 bags)",
      "formula": "Math.ceil(islandLF / 20)",
      "unit": "bag",
      "conditional_field_id": "veneerType",
      "conditional_value": "Brick Veneer"
    },
    {
      "product_name": "Natural Stone Veneer",
      "description": "Natural stone veneer — Face SF",
      "formula": "islandLF * (islandHeightIn / 12)",
      "unit": "SF",
      "conditional_field_id": "veneerType",
      "conditional_value": "Natural Stone Veneer"
    },
    {
      "product_name": "Kitchen Mortar 50lb",
      "description": "Mortar — stone veneer (LF ÷ 20 bags)",
      "formula": "Math.ceil(islandLF / 20)",
      "unit": "bag",
      "conditional_field_id": "veneerType",
      "conditional_value": "Natural Stone Veneer"
    },
    {
      "product_name": "Granite Countertop",
      "description": "Granite countertop — style TBD",
      "formula": "countertopSF",
      "unit": "SF",
      "conditional_field_id": "countertopType",
      "conditional_value": "Granite"
    },
    {
      "product_name": "Concrete Countertop Mat",
      "description": "Poured concrete countertop material",
      "formula": "countertopSF",
      "unit": "SF",
      "conditional_field_id": "countertopType",
      "conditional_value": "Poured Concrete"
    },
    {
      "product_name": "Concrete Countertop Labor",
      "description": "Poured concrete countertop labor",
      "formula": "countertopSF",
      "unit": "SF",
      "conditional_field_id": "countertopType",
      "conditional_value": "Poured Concrete"
    },
    {
      "product_name": "Kitchen Build Labor",
      "description": "Overall island build labor — Face SF × $35 (covers CMU, base, veneer install)",
      "formula": "islandLF * (islandHeightIn / 12)",
      "unit": "SF"
    },
    {
      "product_name": "Wall Delivery",
      "description": "CMU block delivery — block count ÷ 200 per pallet ÷ 10 pallets/truck = loads",
      "formula": "Math.ceil(Math.ceil(Math.ceil((islandLF * (islandHeightIn / 12)) / 0.89 * 1.05) / 200) / 10)",
      "unit": "load"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Outdoor Kitchens v2' AND is_active = true);


-- ════════════════════════════════════════════════════════════
-- WIZARD 3 — RETAINING WALLS v2
-- Branches: Gravity Wall / CMU Retaining Wall / Freestanding Wall
-- Multi-condition logic handled via ternary formulas (qty=0 is skipped by frontend)
-- ════════════════════════════════════════════════════════════

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Retaining & Freestanding Walls Wizard v2',
  'Retaining Walls',
  'Wizard for Gravity Wall (Belgard Highland Stone SRW), CMU retaining wall, and Freestanding Wall (Belgard Weston Stone). Branches automatically based on wall type selection.',
  true,
  '[
    {
      "id": "step_wall_type",
      "title": "Wall Type",
      "fields": [
        {
          "id": "wallType",
          "type": "radio",
          "label": "What type of wall?",
          "required": true,
          "options": ["Retaining Wall", "Freestanding Wall"]
        }
      ]
    },
    {
      "id": "step_retaining_type",
      "title": "Retaining Wall System",
      "conditional_on": { "field_id": "wallType", "value": "Retaining Wall" },
      "fields": [
        {
          "id": "retainingWallType",
          "type": "radio",
          "label": "Retaining wall system",
          "required": true,
          "options": ["Gravity Wall", "CMU Block Wall"],
          "help_text": "Gravity Wall = Belgard Highland Stone SRW. CMU Block Wall = 8×8×16 masonry blocks."
        }
      ]
    },
    {
      "id": "step_dimensions",
      "title": "Wall Dimensions",
      "fields": [
        {
          "id": "wallLF",
          "type": "number",
          "label": "Wall Length (LF)",
          "required": true,
          "placeholder": "e.g. 40"
        },
        {
          "id": "wallHeight",
          "type": "number",
          "label": "Wall Height (ft)",
          "required": true,
          "placeholder": "e.g. 3",
          "help_text": "Retaining wall max 4.5 ft. Freestanding wall max 4 ft. Walls over limit require engineer-stamped design."
        }
      ]
    },
    {
      "id": "step_site",
      "title": "Site Conditions",
      "fields": [
        {
          "id": "siteConditions",
          "type": "radio",
          "label": "Is the site flat and easily accessible?",
          "required": true,
          "options": ["Flat / Easy Access", "Slope / Difficult Access"]
        }
      ]
    },
    {
      "id": "step_demo",
      "title": "Demo",
      "fields": [
        {
          "id": "demoRequired",
          "type": "radio",
          "label": "Demo existing wall / footing?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Adds $6.00/LF demo labor."
        }
      ]
    },
    {
      "id": "step_drainage",
      "title": "Drainage Pipe",
      "conditional_on": { "field_id": "wallType", "value": "Retaining Wall" },
      "fields": [
        {
          "id": "drainageRequired",
          "type": "radio",
          "label": "Install corrugated drainage pipe behind wall?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    },
    {
      "id": "step_drainage_lf",
      "title": "Drainage Pipe Length",
      "conditional_on": { "field_id": "drainageRequired", "value": "Yes" },
      "fields": [
        {
          "id": "drainageLF",
          "type": "number",
          "label": "Drainage pipe length (LF)",
          "required": true,
          "placeholder": "e.g. 40",
          "help_text": "Enter wall LF if same length as wall, or enter custom footage."
        }
      ]
    },
    {
      "id": "step_caps",
      "title": "Wall Caps",
      "fields": [
        {
          "id": "capsRequired",
          "type": "radio",
          "label": "Install wall caps?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Highland Stone SRW Block",
      "description": "Belgard Highland Stone SRW blocks — Face SF ÷ 0.739 (round up)",
      "formula": "retainingWallType === ''Gravity Wall'' ? Math.ceil(wallLF * wallHeight / 0.739) : 0",
      "unit": "each"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "Gravity wall drainage aggregate — LF × (H × 0.75) ÷ 27 × 1.35 → scoops",
      "formula": "retainingWallType === ''Gravity Wall'' ? Math.ceil(wallLF * (wallHeight * 0.75) / 27 * 1.35) : 0",
      "unit": "scoop"
    },
    {
      "product_name": "Retaining Wall Backfill",
      "description": "Gravity wall backfill — LF × (H × 0.5) × 1ft ÷ 27 = CY",
      "formula": "retainingWallType === ''Gravity Wall'' ? Math.ceil(wallLF * wallHeight * 0.5 / 27 * 10) / 10 : 0",
      "unit": "CY"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "Gravity wall footing gravel — LF × 1ft × 1ft ÷ 27 × 1.35 → scoops",
      "formula": "retainingWallType === ''Gravity Wall'' ? Math.ceil(wallLF / 27 * 1.35) : 0",
      "unit": "scoop"
    },
    {
      "product_name": "Retaining Wall Labor Flat",
      "description": "Gravity wall build labor — flat access — Face SF × $45",
      "formula": "retainingWallType === ''Gravity Wall'' && siteConditions === ''Flat / Easy Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Retaining Wall Labor Hard",
      "description": "Gravity wall build labor — difficult access — Face SF × $55",
      "formula": "retainingWallType === ''Gravity Wall'' && siteConditions === ''Slope / Difficult Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Gravity Cap Block",
      "description": "Gravity wall cap blocks — LF × (12 ÷ 17.75) = cap count",
      "formula": "retainingWallType === ''Gravity Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF * 12 / 17.75) : 0",
      "unit": "each"
    },
    {
      "product_name": "Gravity Cap Labor",
      "description": "Install gravity wall cap blocks",
      "formula": "retainingWallType === ''Gravity Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF * 12 / 17.75) : 0",
      "unit": "each"
    },
    {
      "product_name": "Wall Cap Adhesive",
      "description": "Gravity wall cap adhesive — LF ÷ 15 = tubes",
      "formula": "retainingWallType === ''Gravity Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF / 15) : 0",
      "unit": "tube"
    },
    {
      "product_name": "Wall Delivery",
      "description": "Highland Stone delivery — Face SF ÷ 59.1 SF/pallet ÷ 10 pallets/truck = loads",
      "formula": "retainingWallType === ''Gravity Wall'' ? Math.ceil(Math.ceil(wallLF * wallHeight / 59.1) / 10) : 0",
      "unit": "load"
    },
    {
      "product_name": "CMU Retaining Block",
      "description": "CMU block (8×8×16) — Face SF ÷ 0.89 block face area",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(wallLF * wallHeight / 0.89) : 0",
      "unit": "each"
    },
    {
      "product_name": "Retaining Mortar 50lb",
      "description": "CMU mortar bags — LF ÷ 20",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(wallLF / 20) : 0",
      "unit": "bag"
    },
    {
      "product_name": "Retaining Rebar",
      "description": "CMU rebar (#4) — 1 stick per cell, cells = block count ÷ 3",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(Math.ceil(wallLF * wallHeight / 0.89) / 3) : 0",
      "unit": "stick"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "CMU wall drainage aggregate — LF × (H × 0.75) ÷ 27 × 1.35 → scoops",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(wallLF * (wallHeight * 0.75) / 27 * 1.35) : 0",
      "unit": "scoop"
    },
    {
      "product_name": "Retaining Wall Backfill",
      "description": "CMU wall backfill — LF × (H × 0.5) × 1ft ÷ 27 = CY",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(wallLF * wallHeight * 0.5 / 27 * 10) / 10 : 0",
      "unit": "CY"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "CMU wall footing gravel — LF × 1ft × 1ft ÷ 27 × 1.35 → scoops",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(wallLF / 27 * 1.35) : 0",
      "unit": "scoop"
    },
    {
      "product_name": "Retaining Wall Labor Flat",
      "description": "CMU wall build labor — flat access — Face SF × $45",
      "formula": "retainingWallType === ''CMU Block Wall'' && siteConditions === ''Flat / Easy Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Retaining Wall Labor Hard",
      "description": "CMU wall build labor — difficult access — Face SF × $55",
      "formula": "retainingWallType === ''CMU Block Wall'' && siteConditions === ''Slope / Difficult Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Gravity Cap Block",
      "description": "CMU wall cap blocks — LF × (12 ÷ 17.75) = cap count",
      "formula": "retainingWallType === ''CMU Block Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF * 12 / 17.75) : 0",
      "unit": "each"
    },
    {
      "product_name": "Gravity Cap Labor",
      "description": "Install CMU wall cap blocks",
      "formula": "retainingWallType === ''CMU Block Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF * 12 / 17.75) : 0",
      "unit": "each"
    },
    {
      "product_name": "Wall Cap Adhesive",
      "description": "CMU wall cap adhesive — LF ÷ 15 = tubes",
      "formula": "retainingWallType === ''CMU Block Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF / 15) : 0",
      "unit": "tube"
    },
    {
      "product_name": "Wall Delivery",
      "description": "CMU delivery — block count ÷ 200 per pallet ÷ 10 per truck = loads",
      "formula": "retainingWallType === ''CMU Block Wall'' ? Math.ceil(Math.ceil(Math.ceil(wallLF * wallHeight / 0.89) / 200) / 10) : 0",
      "unit": "load"
    },
    {
      "product_name": "Corrugated Drain Pipe",
      "description": "Corrugated drainage pipe behind retaining wall",
      "formula": "wallType === ''Retaining Wall'' && drainageRequired === ''Yes'' ? drainageLF : 0",
      "unit": "LF"
    },
    {
      "product_name": "Wall Demo Labor",
      "description": "Demo existing wall/footing — $6.00/LF",
      "formula": "demoRequired === ''Yes'' ? wallLF : 0",
      "unit": "LF"
    },
    {
      "product_name": "Weston Stone",
      "description": "Belgard Weston Stone freestanding wall — Face SF",
      "formula": "wallType === ''Freestanding Wall'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Freestanding Adhesive",
      "description": "Freestanding wall adhesive — LF ÷ 15 = tubes",
      "formula": "wallType === ''Freestanding Wall'' ? Math.ceil(wallLF / 15) : 0",
      "unit": "tube"
    },
    {
      "product_name": "57 Stone Gravel",
      "description": "Freestanding wall footing gravel — LF × 1ft × 1ft ÷ 27 × 1.35 → scoops",
      "formula": "wallType === ''Freestanding Wall'' ? Math.ceil(wallLF / 27 * 1.35) : 0",
      "unit": "scoop"
    },
    {
      "product_name": "Freestanding Labor Flat",
      "description": "Freestanding wall build labor — flat access — Face SF × $20",
      "formula": "wallType === ''Freestanding Wall'' && siteConditions === ''Flat / Easy Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Freestanding Labor Hard",
      "description": "Freestanding wall build labor — difficult access — Face SF × $30",
      "formula": "wallType === ''Freestanding Wall'' && siteConditions === ''Slope / Difficult Access'' ? wallLF * wallHeight : 0",
      "unit": "SF"
    },
    {
      "product_name": "Freestanding Cap Block",
      "description": "Freestanding wall cap blocks — LF ÷ 1 ft per cap = cap count",
      "formula": "wallType === ''Freestanding Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF) : 0",
      "unit": "each"
    },
    {
      "product_name": "Freestanding Cap Labor",
      "description": "Install freestanding wall cap blocks",
      "formula": "wallType === ''Freestanding Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF) : 0",
      "unit": "each"
    },
    {
      "product_name": "Freestanding Adhesive",
      "description": "Freestanding wall cap adhesive — LF ÷ 15 = tubes",
      "formula": "wallType === ''Freestanding Wall'' && capsRequired === ''Yes'' ? Math.ceil(wallLF / 15) : 0",
      "unit": "tube"
    },
    {
      "product_name": "Wall Delivery",
      "description": "Weston Stone delivery — Face SF ÷ 120 SF/pallet ÷ 10 per truck = loads",
      "formula": "wallType === ''Freestanding Wall'' ? Math.ceil(Math.ceil(wallLF * wallHeight / 120) / 10) : 0",
      "unit": "load"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Retaining Walls' AND is_active = true);


-- ════════════════════════════════════════════════════════════
-- WIZARD 4 — CONCRETE v2
-- Same products as 008 Concrete (referenced by name — no duplicates needed)
-- Updated labor rates: 4"/5" = $6/SF, 6" = $7/SF
-- ════════════════════════════════════════════════════════════

INSERT INTO service_categories (name, is_active)
VALUES ('Concrete v2', true)
ON CONFLICT (name) DO NOTHING;

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Concrete Wizard v2',
  'Concrete v2',
  'Updated concrete wizard. Labor: 4"/5" = $6/SF, 6" = $7/SF. Material unchanged. No demo — use Access & Demolition items. Supports Driveway, Patio, Pool Deck with stamped finish option.',
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
          "help_text": "Driveways include rebar reinforcement. Patios and Pool Decks use wire mesh (TBD)."
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
          "help_text": "Stamped adds +$2.50/SF material and +$1.75/SF labor on top of base rates."
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
          "help_text": "Reference: ~1 scoop per 80-100 SF at 4-inch depth. Admin enters actual count."
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
          "help_text": "Adds $1.00/SF labor surcharge."
        },
        {
          "id": "linePump",
          "type": "radio",
          "label": "Line pump required?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Flat $650 when truck cannot reach pour zone directly."
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Concrete Labor 4 inch",
      "description": "Concrete labor — 4\" pour — $6.00/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "4\""
    },
    {
      "product_name": "Concrete Labor 5 inch",
      "description": "Concrete labor — 5\" pour — $6.00/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "5\""
    },
    {
      "product_name": "Concrete Labor 6 inch",
      "description": "Concrete labor — 6\" pour — $7.00/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "6\""
    },
    {
      "product_name": "Concrete Material 4 inch",
      "description": "Concrete material — 4\" pour — $2.58/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "4\""
    },
    {
      "product_name": "Concrete Material 5 inch",
      "description": "Concrete material — 5\" pour — $3.22/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "5\""
    },
    {
      "product_name": "Concrete Material 6 inch",
      "description": "Concrete material — 6\" pour — $3.87/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "pourDepth",
      "conditional_value": "6\""
    },
    {
      "product_name": "Stamped Labor Upcharge",
      "description": "Stamped finish labor upcharge — +$1.75/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "finishType",
      "conditional_value": "Stamped"
    },
    {
      "product_name": "Stamped Material Upcharge",
      "description": "Stamped finish material upcharge — +$2.50/SF",
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
      "description": "Backyard/difficult access — +$1.00/SF",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "difficultAccess",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Line Pump",
      "description": "Concrete line pump — flat $650",
      "formula": "1",
      "unit": "flat",
      "conditional_field_id": "linePump",
      "conditional_value": "Yes"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Concrete v2' AND is_active = true);
