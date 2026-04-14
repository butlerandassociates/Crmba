-- ============================================================
-- Migration 026: Wizard–Product ID connection + unique constraints
-- ============================================================
-- 1. Add product_id to every active wizard calc_rule by joining
--    with products_services on name (case-insensitive).
--    Rules with no matching product are left as-is (engine
--    falls back to product_name lookup for those).
-- 2. Unique constraints on all lookup tables.
-- 3. Auto-compute price_per_unit trigger on products_services.
-- ============================================================


-- ── 1. Inject product_id into wizard calc_rules ─────────────

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


-- ── 2. Unique constraints — lookup tables ───────────────────

-- estimate_templates: unique name among ACTIVE wizards only
-- (inactive/archived wizards can have duplicate names)
CREATE UNIQUE INDEX IF NOT EXISTS estimate_templates_active_name_unique
  ON estimate_templates(name)
  WHERE is_active = true;

-- appointment_types
ALTER TABLE appointment_types
  DROP CONSTRAINT IF EXISTS appointment_types_name_unique;
ALTER TABLE appointment_types
  ADD CONSTRAINT appointment_types_name_unique UNIQUE (name);

-- scope_of_work
ALTER TABLE scope_of_work
  DROP CONSTRAINT IF EXISTS scope_of_work_name_unique;
ALTER TABLE scope_of_work
  ADD CONSTRAINT scope_of_work_name_unique UNIQUE (name);

-- units
ALTER TABLE units
  DROP CONSTRAINT IF EXISTS units_name_unique;
ALTER TABLE units
  ADD CONSTRAINT units_name_unique UNIQUE (name);

-- service_categories
ALTER TABLE service_categories
  DROP CONSTRAINT IF EXISTS service_categories_name_unique;
ALTER TABLE service_categories
  ADD CONSTRAINT service_categories_name_unique UNIQUE (name);

-- lead_sources
ALTER TABLE lead_sources
  DROP CONSTRAINT IF EXISTS lead_sources_name_unique;
ALTER TABLE lead_sources
  ADD CONSTRAINT lead_sources_name_unique UNIQUE (name);

-- pipeline_stages
ALTER TABLE pipeline_stages
  DROP CONSTRAINT IF EXISTS pipeline_stages_name_unique;
ALTER TABLE pipeline_stages
  ADD CONSTRAINT pipeline_stages_name_unique UNIQUE (name);

-- roles: name already unique (migration 003). Add label unique.
ALTER TABLE roles
  DROP CONSTRAINT IF EXISTS roles_label_unique;
ALTER TABLE roles
  ADD CONSTRAINT roles_label_unique UNIQUE (label);

-- permissions: key already unique (migration 003). Add label unique.
ALTER TABLE permissions
  DROP CONSTRAINT IF EXISTS permissions_label_unique;
ALTER TABLE permissions
  ADD CONSTRAINT permissions_label_unique UNIQUE (label);

-- zip_tax_rates: zip_code is the natural key
ALTER TABLE zip_tax_rates
  DROP CONSTRAINT IF EXISTS zip_tax_rates_zip_code_unique;
ALTER TABLE zip_tax_rates
  ADD CONSTRAINT zip_tax_rates_zip_code_unique UNIQUE (zip_code);


-- ── 3. Auto-compute price_per_unit on every product update ──

CREATE OR REPLACE FUNCTION compute_price_per_unit()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.price_per_unit :=
    (NEW.material_cost + NEW.labor_cost)
    * (1 + NEW.markup_percentage / 100);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_compute_price_per_unit ON products_services;
CREATE TRIGGER trg_compute_price_per_unit
  BEFORE INSERT OR UPDATE OF material_cost, labor_cost, markup_percentage
  ON products_services
  FOR EACH ROW
  EXECUTE FUNCTION compute_price_per_unit();

-- Backfill stale price_per_unit values for all existing products
UPDATE products_services
SET price_per_unit =
  (material_cost + labor_cost) * (1 + markup_percentage / 100);
