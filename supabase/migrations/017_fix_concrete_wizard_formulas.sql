-- ============================================================
-- Migration 017: Fix broken OLD Concrete wizard calc_rules
-- April 2026 — Jonathan confirmed
--
-- Targets the old manually-created Concrete wizard in DB.
-- Fixes:
--   1. "Install Concrete (4")" formula = "squareFootage * 7" → squareFootage
--   2. Truncated "squareFootage *" → squareFootage
--   3. "Gravel Base (3/4")" → "57 Stone Gravel", SF/100 scoops
--      (Jonathan: 1 scoop = 1 ton = 100 SF)
--   4. Remove Demo & Haul Away from wizard entirely
--      (Jonathan: remove from wizard, keep in A&D only)
-- ============================================================

UPDATE public.estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(fixed_rule)
  FROM (
    SELECT
      CASE
        WHEN rule->>'formula' = 'squareFootage * 7'
          THEN jsonb_set(rule, '{formula}', '"squareFootage"')
        WHEN rule->>'formula' = 'squareFootage *'
          THEN jsonb_set(rule, '{formula}', '"squareFootage"')
        WHEN rule->>'product_name' = 'Gravel Base (3/4")'
          THEN rule
            || jsonb_build_object('product_name', '57 Stone Gravel')
            || jsonb_build_object('formula', 'Math.ceil(squareFootage / 100)')
            || jsonb_build_object('unit', 'scoop')
            || jsonb_build_object('description', '57-stone gravel base — 1 scoop per 100 SF (1 scoop = 1 ton = 100 SF)')
        ELSE rule
      END AS fixed_rule,
      rule AS original_rule
    FROM jsonb_array_elements(calc_rules) AS rule
  ) sub
  -- Remove Demo & Haul Away entirely — goes to A&D only
  WHERE original_rule->>'product_name' NOT ILIKE '%demo%'
    AND original_rule->>'product_name' NOT ILIKE '%haul%'
)
WHERE is_active = true
  AND (
    calc_rules::text LIKE '%squareFootage * 7%'
    OR calc_rules::text LIKE '%squareFootage *"%'
    OR calc_rules::text ILIKE '%Gravel Base (3/4")%'
    OR calc_rules::text ILIKE '%Demo%Haul%'
  );
