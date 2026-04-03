-- ============================================================
-- Migration 007: Wizard Templates v3 — Pavers, Retaining Walls,
--                Outdoor Kitchens, Sod + all required products
-- Based on CRM_Wizard_Flow_Spec_v3.pdf (March 31, 2026)
-- ============================================================

-- ── 1. Ensure service categories exist ──────────────────────

INSERT INTO service_categories (name, is_active)
VALUES
  ('Pavers', true),
  ('Retaining Walls', true),
  ('Outdoor Kitchens', true),
  ('Sod', true)
ON CONFLICT (name) DO NOTHING;

-- ── 2. Units ─────────────────────────────────────────────────

INSERT INTO units (name)
VALUES ('SF'), ('ton'), ('bag'), ('LF'), ('load'), ('CY'), ('each'), ('roll'), ('tube'), ('stick'), ('scoop'), ('flat')
ON CONFLICT (name) DO NOTHING;

-- ── 3. Products — Pavers ─────────────────────────────────────
-- All rates are PRE-markup. markup_percentage=50 → client price = cost × 1.50

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = p.cat)
FROM (VALUES
  ('Paver Material',
   'Interlocking concrete pavers — update unit cost in catalog before each project (catalog price per SF)',
   4.50, 0.00, 'Pavers', 'SF'),
  ('Crushed Stone Base',
   'Compacted 3/4" minus angular crushed stone base for pavers',
   200.00, 0.00, 'Pavers', 'ton'),
  ('Polymeric Joint Sand',
   'Polymeric jointing sand — 1 bag per 25 SF',
   45.00, 0.00, 'Pavers', 'bag'),
  ('Edge Restraint',
   'Rigid plastic edge restraint with spikes — charged per SF of paver area',
   0.75, 0.75, 'Pavers', 'SF'),
  ('Paver Installation Labor',
   'Install pavers — includes SF with 10% waste factor',
   0.00, 9.00, 'Pavers', 'SF'),
  ('Difficult Access Surcharge',
   'Additional labor surcharge for backyard or confined access',
   0.00, 1.00, 'Pavers', 'SF')
) AS p(name, description, material_cost, labor_cost, cat, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 4. Products — Retaining Walls ────────────────────────────

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = p.cat)
FROM (VALUES
  ('CMU Block',
   'Concrete masonry unit — 8"x8"x16" standard block',
   2.67, 0.00, 'Retaining Walls', 'each'),
  ('Segmental Block',
   'Segmental retaining wall block (Belgard/Allan Block) — update cost from catalog before each project',
   3.50, 0.00, 'Retaining Walls', 'each'),
  ('Block Installation Labor',
   'Install retaining wall block — both CMU and segmental systems, per SF of wall face',
   0.00, 45.00, 'Retaining Walls', 'SF'),
  ('Cap Block Material',
   'Retaining wall cap block material',
   6.50, 0.00, 'Retaining Walls', 'each'),
  ('Cap Block Labor',
   'Install retaining wall cap blocks',
   0.00, 10.00, 'Retaining Walls', 'each'),
  ('Gravel Base (Wall)',
   'Compacted gravel base under first course of retaining wall',
   200.00, 0.00, 'Retaining Walls', 'ton'),
  ('Drainage Aggregate',
   '3/4" clean crushed stone drainage aggregate behind retaining wall',
   200.00, 0.00, 'Retaining Walls', 'ton'),
  ('Perforated Drain Pipe Material',
   'Perforated drain pipe at base of retaining wall',
   30.00, 0.00, 'Retaining Walls', 'LF'),
  ('Perforated Drain Pipe Labor',
   'Install perforated drain pipe at base of retaining wall',
   0.00, 10.00, 'Retaining Walls', 'LF'),
  ('Geotextile Fabric',
   'Geotextile filter fabric — 1 roll = 2ft × 100ft = 200 SF',
   250.00, 0.00, 'Retaining Walls', 'roll'),
  ('Rebar (Wall)',
   'Rebar for CMU retaining walls — every other core',
   11.00, 0.00, 'Retaining Walls', 'stick'),
  ('Mortar Grout',
   'Mortar/grout bags for CMU walls — approx 1 bag per 8-10 blocks',
   25.00, 0.00, 'Retaining Walls', 'bag'),
  ('Construction Adhesive',
   'Construction adhesive for cap blocks — 1 tube per 30 LF',
   9.00, 0.00, 'Retaining Walls', 'tube'),
  ('Backfill Import',
   'Import fill material for backfill behind retaining wall',
   35.00, 0.00, 'Retaining Walls', 'CY'),
  ('Demo Wall Labor',
   'Remove existing retaining wall',
   0.00, 30.00, 'Retaining Walls', 'LF'),
  ('Demo Container Haul-off',
   'Debris container for demo material haul-off',
   350.00, 0.00, 'Retaining Walls', 'load'),
  ('Wall Delivery',
   'Material delivery — $275.00/load (10 pallets per truck)',
   275.00, 0.00, 'Retaining Walls', 'load')
) AS p(name, description, material_cost, labor_cost, cat, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 5. Products — Outdoor Kitchens ───────────────────────────

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = p.cat)
FROM (VALUES
  ('Footing Material',
   'Concrete footing material for outdoor kitchen island base',
   30.00, 0.00, 'Outdoor Kitchens', 'SF'),
  ('Footing Labor',
   'Install concrete footing for outdoor kitchen island — per SF of wall face',
   0.00, 45.00, 'Outdoor Kitchens', 'SF'),
  ('Veneer Finish Labor',
   'Exterior veneer/finish labor for outdoor kitchen island — stucco, stone, or tile',
   0.00, 12.00, 'Outdoor Kitchens', 'LF'),
  ('Veneer Finish Material',
   'Exterior veneer/finish material — admin enters total material cost per project (varies by client selection)',
   0.00, 0.00, 'Outdoor Kitchens', 'each'),
  ('Appliance Installation Labor',
   'Install outdoor kitchen appliances (grill, fridge, side burner, sink, pizza oven, etc.)',
   0.00, 125.00, 'Outdoor Kitchens', 'each'),
  ('Appliance Cutout Labor',
   'Cutout for appliance installation',
   0.00, 35.00, 'Outdoor Kitchens', 'each'),
  ('Demo Structure Labor',
   'Remove existing outdoor structure',
   0.00, 30.00, 'Outdoor Kitchens', 'LF')
) AS p(name, description, material_cost, labor_cost, cat, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 6. Products — Sod ────────────────────────────────────────

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = p.cat)
FROM (VALUES
  ('Sod Supply and Install',
   'Supply and install sod — all-in rate includes sod material, install labor, starter fertilizer, and lawn rolling',
   1.17, 1.16, 'Sod', 'SF'),
  ('Grading',
   'Site grading including site prep, tilling, and rough grade — tilling is included, not a separate item',
   17.50, 17.50, 'Sod', 'SF'),
  ('Topsoil Import',
   'Import topsoil — includes material, delivery, and spread all-in',
   200.00, 0.00, 'Sod', 'CY'),
  ('Finish Grading',
   'Final surface smoothing to hardscape edges',
   5.00, 5.00, 'Sod', 'SF'),
  ('Sod Demo Haul-off',
   'Haul off sod and soil — priced per CY (NOT per load container)',
   200.00, 0.00, 'Sod', 'CY')
) AS p(name, description, material_cost, labor_cost, cat, unit)
ON CONFLICT (name) DO NOTHING;

-- ── 7. Shared products (Concrete already has these, upsert safe) ─

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
VALUES
  ('Line Pump', 'Concrete line pump — flat rate', 650.00, 0.00, 50, 'flat', true,
    (SELECT id FROM service_categories WHERE name = 'Concrete' LIMIT 1))
ON CONFLICT (name) DO NOTHING;


-- ╔══════════════════════════════════════════════════════════════╗
-- ║  WIZARD TEMPLATES                                           ║
-- ╚══════════════════════════════════════════════════════════════╝

-- ── WIZARD 2 — PAVERS ────────────────────────────────────────
-- Guard: only inserts if no template for 'Pavers' category already exists

INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Pavers Wizard',
  'Pavers',
  'Wizard for paver driveways, patios, and pool decks. Calculates paver material (10% waste), crushed stone base, polymeric sand, edge restraint, and installation labor.',
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
          "options": ["Driveway", "Patio", "Pool Deck"]
        },
        {
          "id": "squareFootage",
          "type": "number",
          "label": "Square Footage (SF)",
          "required": true,
          "placeholder": "e.g. 400",
          "help_text": "Total paver area. System auto-adds 10% waste to material."
        }
      ]
    },
    {
      "id": "step_materials",
      "title": "Materials",
      "fields": [
        {
          "id": "gravelTons",
          "type": "number",
          "label": "Crushed Stone Base (tons)",
          "required": true,
          "placeholder": "e.g. 6",
          "help_text": "Reference: SF × depth(in) ÷ 12 × 1.35 ÷ 27 × 1.35. Driveways: 10-12 inch depth. Patios: 7-8 inch."
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
          "label": "Difficult access (backyard or confined)?",
          "required": true,
          "options": ["Yes", "No"]
        },
        {
          "id": "demoRequired",
          "type": "radio",
          "label": "Existing material to demo & haul off?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    },
    {
      "id": "step_demo",
      "title": "Demo Details",
      "conditional_on": { "field_id": "demoRequired", "value": "Yes" },
      "fields": [
        {
          "id": "demoLoads",
          "type": "number",
          "label": "Number of haul-off loads",
          "required": true,
          "placeholder": "e.g. 2",
          "help_text": "Container haul-off: $350/load material. Note: Pavers demo labor is included in installation — no separate demo labor charge."
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Paver Material",
      "description": "Interlocking concrete pavers with 10% waste factor — verify unit cost in product catalog before using",
      "formula": "squareFootage * 1.1",
      "unit": "SF"
    },
    {
      "product_name": "Crushed Stone Base",
      "description": "Compacted crushed stone base for pavers",
      "formula": "gravelTons",
      "unit": "ton"
    },
    {
      "product_name": "Polymeric Joint Sand",
      "description": "Polymeric joint sand — 1 bag per 25 SF (auto-calculated)",
      "formula": "Math.ceil(squareFootage / 25)",
      "unit": "bag"
    },
    {
      "product_name": "Edge Restraint",
      "description": "Rigid edge restraint — charged per SF of total paver area",
      "formula": "squareFootage",
      "unit": "SF"
    },
    {
      "product_name": "Paver Installation Labor",
      "description": "Install pavers including 10% waste factor",
      "formula": "squareFootage * 1.1",
      "unit": "SF"
    },
    {
      "product_name": "Difficult Access Surcharge",
      "description": "Difficult access labor surcharge",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "difficultAccess",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Demo Container Haul-off",
      "description": "Container haul-off for demo material",
      "formula": "demoLoads",
      "unit": "load",
      "conditional_field_id": "demoRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Wall Delivery",
      "description": "Paver delivery — SF × 1.1 waste ÷ 120 SF/pallet ÷ 10 pallets/truck = loads",
      "formula": "Math.ceil(Math.ceil(squareFootage * 1.1 / 120) / 10)",
      "unit": "load"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Pavers' AND is_active = true);


-- ── WIZARD 3 — RETAINING WALLS ───────────────────────────────
-- ⚠ Retaining Walls wizard moved to migration 009 (updated spec with Gravity/CMU/Freestanding branching)

-- Retaining Walls wizard is in migration 009 with the updated spec.


-- ── WIZARD 4 — OUTDOOR KITCHENS ──────────────────────────────

-- Guard: only inserts if no template for 'Outdoor Kitchens' category already exists
INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Outdoor Kitchens Wizard',
  'Outdoor Kitchens',
  'Wizard for CMU outdoor kitchen islands. Calculates block count, installation labor, footing, exterior veneer, appliances, and cutouts. Countertop is by others (client coordinates separately).',
  true,
  '[
    {
      "id": "step_config",
      "title": "Island Configuration",
      "fields": [
        {
          "id": "islandConfig",
          "type": "radio",
          "label": "Island Configuration",
          "required": true,
          "options": ["Single Island", "L-Shape", "U-Shape", "Custom"],
          "help_text": "Reference only — does not affect pricing. All pricing is based on linear feet."
        },
        {
          "id": "islandLF",
          "type": "number",
          "label": "Total Island Linear Feet (LF)",
          "required": true,
          "placeholder": "e.g. 12",
          "help_text": "Total perimeter of all island runs."
        }
      ]
    },
    {
      "id": "step_dimensions",
      "title": "Island Dimensions",
      "fields": [
        {
          "id": "islandHeightIn",
          "type": "number",
          "label": "Island Height (inches)",
          "required": true,
          "placeholder": "e.g. 36",
          "help_text": "Standard counter height = 36 inches. Bar height = 42 inches."
        },
        {
          "id": "blockFaceSF",
          "type": "number",
          "label": "CMU block face size (SF per block)",
          "required": true,
          "placeholder": "0.44",
          "help_text": "Standard 8x8x16 CMU = 0.44 SF face."
        }
      ]
    },
    {
      "id": "step_appliances",
      "title": "Appliances & Finish",
      "fields": [
        {
          "id": "applianceCount",
          "type": "number",
          "label": "Number of appliances",
          "required": true,
          "placeholder": "e.g. 3",
          "help_text": "Count all appliances: grill, fridge, side burner, sink, pizza oven, etc."
        },
        {
          "id": "cutoutCount",
          "type": "number",
          "label": "Number of cutouts",
          "required": true,
          "placeholder": "e.g. 3",
          "help_text": "Typically equals appliance count."
        }
      ]
    },
    {
      "id": "step_options",
      "title": "Additional Scope",
      "fields": [
        {
          "id": "demoRequired",
          "type": "radio",
          "label": "Existing structure to demo & haul off?",
          "required": true,
          "options": ["Yes", "No"]
        }
      ]
    },
    {
      "id": "step_demo",
      "title": "Demo Details",
      "conditional_on": { "field_id": "demoRequired", "value": "Yes" },
      "fields": [
        {
          "id": "demoStructureLF",
          "type": "number",
          "label": "Existing structure to remove (LF)",
          "required": true,
          "placeholder": "e.g. 10"
        },
        {
          "id": "demoLoads",
          "type": "number",
          "label": "Haul-off loads",
          "required": true,
          "placeholder": "e.g. 1"
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "CMU Block",
      "description": "CMU blocks for outdoor kitchen island — height in courses (8 inch per course) + 5% waste",
      "formula": "Math.ceil((islandLF * (islandHeightIn / 8) / blockFaceSF) * 1.05)",
      "unit": "each"
    },
    {
      "product_name": "Block Installation Labor",
      "description": "Install CMU block — per SF of wall face (LF × height in ft)",
      "formula": "islandLF * (islandHeightIn / 12)",
      "unit": "SF"
    },
    {
      "product_name": "Footing Labor",
      "description": "Concrete footing labor for island — same rate as CMU install, per wall face SF",
      "formula": "islandLF * (islandHeightIn / 12)",
      "unit": "SF"
    },
    {
      "product_name": "Footing Material",
      "description": "Concrete footing material — per wall face SF",
      "formula": "islandLF * (islandHeightIn / 12)",
      "unit": "SF"
    },
    {
      "product_name": "Veneer Finish Labor",
      "description": "Exterior veneer/finish labor — per LF of island",
      "formula": "islandLF",
      "unit": "LF"
    },
    {
      "product_name": "Appliance Installation Labor",
      "description": "Install outdoor kitchen appliances",
      "formula": "applianceCount",
      "unit": "each"
    },
    {
      "product_name": "Appliance Cutout Labor",
      "description": "Cutouts for appliance installation",
      "formula": "cutoutCount",
      "unit": "each"
    },
    {
      "product_name": "Demo Structure Labor",
      "description": "Remove existing outdoor structure",
      "formula": "demoStructureLF",
      "unit": "LF",
      "conditional_field_id": "demoRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Demo Container Haul-off",
      "description": "Container haul-off for demo debris",
      "formula": "demoLoads",
      "unit": "load",
      "conditional_field_id": "demoRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Wall Delivery",
      "description": "CMU block delivery — block count ÷ 200 per pallet ÷ 10 pallets/truck = loads",
      "formula": "Math.ceil(Math.ceil(Math.ceil((islandLF * (islandHeightIn / 8) / blockFaceSF) * 1.05) / 200) / 10)",
      "unit": "load"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Outdoor Kitchens' AND is_active = true);


-- ── WIZARD 5 — SOD ───────────────────────────────────────────

-- Guard: only inserts if no template for 'Sod' category already exists
INSERT INTO estimate_templates (name, category, description, is_active, steps, calc_rules)
SELECT
  'Sod Wizard',
  'Sod',
  'Wizard for sod supply and install. Base rate $2.33/SF all-in includes material, install, starter fertilizer, and lawn rolling. Optional: grading, topsoil import, finish grading. Demo uses CY-based haul-off (not per-load).',
  true,
  '[
    {
      "id": "step_area",
      "title": "Sod Area",
      "fields": [
        {
          "id": "squareFootage",
          "type": "number",
          "label": "Total Sod Area (SF)",
          "required": true,
          "placeholder": "e.g. 2000",
          "help_text": "Total area to be sodded. Base rate $2.33/SF includes sod material, install, starter fertilizer, and lawn rolling."
        }
      ]
    },
    {
      "id": "step_prep",
      "title": "Site Preparation",
      "fields": [
        {
          "id": "gradingRequired",
          "type": "radio",
          "label": "Grading required?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Includes site prep, tilling, and rough grade — all-in. Tilling is NOT a separate item."
        },
        {
          "id": "topsoilRequired",
          "type": "radio",
          "label": "Topsoil import required?",
          "required": true,
          "options": ["Yes", "No"]
        },
        {
          "id": "finishGradingRequired",
          "type": "radio",
          "label": "Finish grading required?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Final surface smoothing to hardscape edges."
        }
      ]
    },
    {
      "id": "step_topsoil",
      "title": "Topsoil Details",
      "conditional_on": { "field_id": "topsoilRequired", "value": "Yes" },
      "fields": [
        {
          "id": "topsoilCY",
          "type": "number",
          "label": "Topsoil needed (cubic yards)",
          "required": true,
          "placeholder": "e.g. 10"
        }
      ]
    },
    {
      "id": "step_demo",
      "title": "Demo & Haul-off",
      "fields": [
        {
          "id": "demoRequired",
          "type": "radio",
          "label": "Existing sod / material to haul off?",
          "required": true,
          "options": ["Yes", "No"],
          "help_text": "Sod haul-off is priced per CY (NOT per load). Demo labor is included in grading step."
        }
      ]
    },
    {
      "id": "step_demo_details",
      "title": "Haul-off Details",
      "conditional_on": { "field_id": "demoRequired", "value": "Yes" },
      "fields": [
        {
          "id": "demoCY",
          "type": "number",
          "label": "Material to haul off (cubic yards)",
          "required": true,
          "placeholder": "e.g. 8",
          "help_text": "Estimate CY of sod/soil to remove. $200/CY — different from other wizard haul-offs."
        }
      ]
    }
  ]'::jsonb,
  '[
    {
      "product_name": "Sod Supply and Install",
      "description": "Supply and install sod — includes material, labor, starter fertilizer, and lawn rolling",
      "formula": "squareFootage",
      "unit": "SF"
    },
    {
      "product_name": "Grading",
      "description": "Site grading with tilling and rough grade",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "gradingRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Topsoil Import",
      "description": "Import topsoil — material, delivery, and spread all-in",
      "formula": "topsoilCY",
      "unit": "CY",
      "conditional_field_id": "topsoilRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Finish Grading",
      "description": "Final surface smoothing to hardscape edges",
      "formula": "squareFootage",
      "unit": "SF",
      "conditional_field_id": "finishGradingRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Sod Demo Haul-off",
      "description": "Haul off sod and soil by cubic yard — different from other wizard haul-offs",
      "formula": "demoCY",
      "unit": "CY",
      "conditional_field_id": "demoRequired",
      "conditional_value": "Yes"
    },
    {
      "product_name": "Wall Delivery",
      "description": "Sod delivery — flat 1 load charge (delivery always applies)",
      "formula": "1",
      "unit": "load"
    }
  ]'::jsonb
WHERE NOT EXISTS (SELECT 1 FROM estimate_templates WHERE category = 'Sod' AND is_active = true);
