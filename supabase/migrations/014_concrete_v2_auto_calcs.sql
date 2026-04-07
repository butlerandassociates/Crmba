-- ============================================================
-- Migration 014: Concrete v2 Wizard — Auto-calculate rebar & gravel
-- Jonathan confirmed (April 2026):
--   - Rebar: 1 stick per 20 SF at 4-ft grid → Math.ceil(squareFootage / 20)
--   - 57-Stone scoops: 1 scoop = 1 ton = 100 SF → Math.ceil(squareFootage / 100)
-- Both fields removed from wizard steps (no manual entry needed)
-- ============================================================

UPDATE public.estimate_templates
SET
  -- Remove step_rebar and step_base manual input steps from steps JSON
  steps = (
    SELECT jsonb_agg(step)
    FROM jsonb_array_elements(steps) AS step
    WHERE step->>'id' NOT IN ('step_rebar', 'step_base')
  ),

  -- Update calc_rules: replace manual variable formulas with auto-calc
  calc_rules = (
    SELECT jsonb_agg(
      CASE
        WHEN rule->>'formula' = 'rebarSticks'
          THEN jsonb_set(rule, '{formula}', '"Math.ceil(squareFootage / 20)"')
        WHEN rule->>'formula' = 'scoopCount'
          THEN jsonb_set(rule, '{formula}', '"Math.ceil(squareFootage / 100)"')
        ELSE rule
      END
    )
    FROM jsonb_array_elements(calc_rules) AS rule
  )

WHERE category = 'Concrete v2'
  AND is_active = true;
