-- ============================================================
-- Migration 011: Concrete Wizard — Pricing & Structure Update
-- Jonathan confirmed (April 2026):
--   - Concrete material billed per CY at $190/CY (3500 PSI)
--   - Install labor = $7/SF pre-markup (labor only, no material on this line)
--   - The $3/SF material was a CY→SF breakdown — remove from install line
--   - 50% markup applies to all products
--   - CY quantity auto-calculated from SF × depth internally
-- ============================================================


-- ── 1. Add Concrete Mix (3500 PSI) product ───────────────────
-- Billed per CY. $190/CY material, 50% markup → $285/CY client price.

INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, service_category_id)
SELECT
  'Concrete Mix (3500 PSI)',
  'Ready-mix concrete (3500 PSI) — $190/CY pre-markup. Quantity in cubic yards.',
  190.00, 0.00, 50, 'CY', true,
  (SELECT id FROM service_categories WHERE name = 'Concrete' LIMIT 1)
WHERE NOT EXISTS (SELECT 1 FROM products_services WHERE name = 'Concrete Mix (3500 PSI)');


-- ── 2. Update labor rates → $7/SF pre-markup ─────────────────

UPDATE public.products_services
SET labor_cost = 7.00,
    description = 'Concrete installation labor — 4-inch pour — $7.00/SF pre-markup'
WHERE name = 'Concrete Labor 4 inch';

UPDATE public.products_services
SET labor_cost = 7.00,
    description = 'Concrete installation labor — 5-inch pour — $7.00/SF pre-markup'
WHERE name = 'Concrete Labor 5 inch';

UPDATE public.products_services
SET labor_cost = 7.00,
    description = 'Concrete installation labor — 6-inch pour — $7.00/SF pre-markup'
WHERE name = 'Concrete Labor 6 inch';


-- ── 3. Update wizard calc_rules ───────────────────────────────
-- Replace per-SF material lines with a single CY-based Concrete Mix line.
-- CY formula: squareFootage × (depth_inches / 12) / 27, rounded up to 1 decimal.
-- Labor lines keep squareFootage as quantity (per SF).

UPDATE public.estimate_templates
SET calc_rules = '[
  {
    "product_name": "Concrete Mix (3500 PSI)",
    "description": "Concrete material — 4-inch pour — SF × (4/12) ÷ 27 = CY",
    "formula": "Math.ceil((squareFootage * (4 / 12) / 27) * 10) / 10",
    "unit": "CY",
    "conditional_field_id": "pourDepth",
    "conditional_value": "4\""
  },
  {
    "product_name": "Concrete Mix (3500 PSI)",
    "description": "Concrete material — 5-inch pour — SF × (5/12) ÷ 27 = CY",
    "formula": "Math.ceil((squareFootage * (5 / 12) / 27) * 10) / 10",
    "unit": "CY",
    "conditional_field_id": "pourDepth",
    "conditional_value": "5\""
  },
  {
    "product_name": "Concrete Mix (3500 PSI)",
    "description": "Concrete material — 6-inch pour — SF × (6/12) ÷ 27 = CY",
    "formula": "Math.ceil((squareFootage * (6 / 12) / 27) * 10) / 10",
    "unit": "CY",
    "conditional_field_id": "pourDepth",
    "conditional_value": "6\""
  },
  {
    "product_name": "Concrete Labor 4 inch",
    "description": "Concrete installation labor — 4-inch pour — $7/SF pre-markup",
    "formula": "squareFootage",
    "unit": "SF",
    "conditional_field_id": "pourDepth",
    "conditional_value": "4\""
  },
  {
    "product_name": "Concrete Labor 5 inch",
    "description": "Concrete installation labor — 5-inch pour — $7/SF pre-markup",
    "formula": "squareFootage",
    "unit": "SF",
    "conditional_field_id": "pourDepth",
    "conditional_value": "5\""
  },
  {
    "product_name": "Concrete Labor 6 inch",
    "description": "Concrete installation labor — 6-inch pour — $7/SF pre-markup",
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
WHERE category = 'Concrete' AND is_active = true;
