-- ============================================================
-- Migration 027: Add missing Sod Demo Haul-off calc_rule
-- ============================================================
-- The Sod wizard has a "demoRequired" field (Yes/No) and a
-- "demoCY" measurement field, and the product "Sod Demo Haul-off"
-- exists in products_services — but the calc_rule was never added.
-- This migration adds it and then re-runs the product_id injection
-- so the new rule gets its product_id linked too.
-- ============================================================

-- Step 1: Append the missing calc_rule to the Sod wizard
UPDATE estimate_templates
SET calc_rules = calc_rules || jsonb_build_array(
  jsonb_build_object(
    'product_name',        'Sod Demo Haul-off',
    'formula',             'demoCY',
    'unit',                'CY',
    'conditional_field_id','demoRequired',
    'conditional_value',   'Yes'
  )
)
WHERE name ILIKE '%sod%'
  AND is_active = true;


-- Step 2: Re-inject product_id for all active wizard calc_rules
-- (same logic as migration 026 — runs again to pick up the new rule)
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
