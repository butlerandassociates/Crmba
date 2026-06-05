-- ============================================================
-- Migration 099: Wizard Material Variants
-- Butler & Associates CRM
--
-- WHY (Jonathan, Jun 2026): the Retaining Walls wizard hardcodes
--   "Highland Stone SRW Block" + "Gravity Cap Block". He wants to pick from
--   multiple block types (Highland Stone, Weston Stone, …) in Step 2, with the
--   matching cap auto-selected (1-to-1). Same idea for Pavers (paver brand/type).
--   Admin manages the options + unit prices here — no dev needed to add a type.
--
-- MODEL: one row = one selectable option in the wizard picker.
--   wizard_type  'retaining_walls' | 'pavers'
--   role         which picker slot: 'gravity_wall_block' | 'paver_material'
--   product_name primary product (must match products_services.name)
--   price_override  admin-set pre-markup unit cost (NULL = use catalog price)
--   cap_product_name / cap_price_override  the paired cap (walls only) — selecting
--                   the block auto-applies this cap (1-to-1). NULL for pavers.
--   is_default   the option pre-selected in the wizard
--
-- The wizard finds the DEFAULT variant's product_name + cap_product_name as the
-- "anchors" that appear in the calc rules, and swaps them to whatever the user
-- selects (name + price). Quantity formulas are unchanged — only the product and
-- its unit price change, exactly as Jonathan requested.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.wizard_material_variants (
  id                 uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  wizard_type        text          NOT NULL CHECK (wizard_type IN ('retaining_walls', 'pavers')),
  role               text          NOT NULL,                -- 'gravity_wall_block' | 'paver_material'
  label              text          NOT NULL,                -- display name in picker
  product_name       text          NOT NULL,                -- matches products_services.name
  price_override     numeric(10,4) NULL,                    -- pre-markup unit cost; NULL = catalog
  cap_product_name   text          NULL,                    -- paired cap (walls); NULL for pavers
  cap_price_override numeric(10,4) NULL,
  is_default         boolean       NOT NULL DEFAULT false,
  sort_order         int           NOT NULL DEFAULT 0,
  is_active          boolean       NOT NULL DEFAULT true,
  created_at         timestamptz   NOT NULL DEFAULT now(),
  updated_at         timestamptz   NOT NULL DEFAULT now(),
  created_by         uuid          REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by         uuid          REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.wizard_material_variants IS 'Selectable material options for wizard pickers (Gravity Wall block types incl. their cap, paver brands). Admin-managed via Product & Pricing Manager → Wizard Materials.';
COMMENT ON COLUMN public.wizard_material_variants.role             IS 'Picker slot: gravity_wall_block | paver_material';
COMMENT ON COLUMN public.wizard_material_variants.product_name     IS 'Primary product — matches products_services.name (used for labor/material cost + markup)';
COMMENT ON COLUMN public.wizard_material_variants.price_override   IS 'Pre-markup unit cost override for this variant; NULL = use products_services price';
COMMENT ON COLUMN public.wizard_material_variants.cap_product_name IS 'Paired wall cap product (1-to-1) — auto-applied when this block is selected';

CREATE INDEX IF NOT EXISTS idx_wizard_variants_type_role ON public.wizard_material_variants(wizard_type, role);

DO $$ BEGIN
  CREATE TRIGGER trg_wizard_material_variants_updated_at
    BEFORE UPDATE ON public.wizard_material_variants
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.wizard_material_variants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wizard_variants_admin" ON public.wizard_material_variants FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "wizard_variants_read"  ON public.wizard_material_variants FOR SELECT
  USING (auth.role() = 'authenticated');

-- Idempotency guard: unique on (wizard_type, role, product_name) so seeds + future
-- inserts can't duplicate and the migration is safe to re-run.
DO $$ BEGIN
  ALTER TABLE public.wizard_material_variants
    ADD CONSTRAINT wizard_variants_unique UNIQUE (wizard_type, role, product_name);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ── Seed: Retaining Walls — Gravity Wall blocks (with paired caps) ────────────
INSERT INTO public.wizard_material_variants
  (wizard_type, role, label, product_name, price_override, cap_product_name, cap_price_override, is_default, sort_order)
VALUES
  ('retaining_walls', 'gravity_wall_block', 'Highland Stone',
   'Highland Stone SRW Block', NULL, 'Gravity Cap Block', NULL, true,  0),
  ('retaining_walls', 'gravity_wall_block', 'Weston Stone',
   'Weston Stone Wall Block',  5.53, 'Weston Stone Cap Block', NULL, false, 1)
ON CONFLICT (wizard_type, role, product_name) DO NOTHING;

-- ── Seed: Pavers — paver material (Jonathan adds brands as needed) ────────────
INSERT INTO public.wizard_material_variants
  (wizard_type, role, label, product_name, price_override, is_default, sort_order)
VALUES
  ('pavers', 'paver_material', 'Standard Paver', 'Paver Material', NULL, true, 0)
ON CONFLICT (wizard_type, role, product_name) DO NOTHING;

-- ── Ensure Weston Stone products exist in the catalog ─────────────────────────
INSERT INTO products_services (name, description, material_cost, labor_cost, markup_percentage, unit, is_active, category_id)
SELECT
  p.name, p.description, p.material_cost, p.labor_cost, 50, p.unit, true,
  (SELECT id FROM service_categories WHERE name = 'Retaining Walls' LIMIT 1)
FROM (VALUES
  ('Weston Stone Wall Block',
   'Belgard Weston Stone SRW retaining wall block — price managed in Wizard Materials',
   5.53, 0.00, 'each'),
  ('Weston Stone Cap Block',
   'Belgard Weston Stone cap block — price managed in Wizard Materials',
   6.50, 0.00, 'each')
) AS p(name, description, material_cost, labor_cost, unit)
WHERE NOT EXISTS (SELECT 1 FROM products_services WHERE name = p.name);
