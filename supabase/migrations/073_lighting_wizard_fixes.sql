-- ============================================================
-- Migration 073: Lighting Wizard Fixes — Jonathan May 22 2026
--   1. Make Up Light / Ledge Light / Ground Light qty fields optional
--   2. Clear description from all calc rules (product editor is authoritative)
--   3. Fix transformer formula to handle blank inputs safely (|| 0)
-- ============================================================


-- ── 1. Make light qty fields optional in Step 1 ─────────────

UPDATE estimate_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step.value->>'id' = 'step_lights'
      THEN step.value || jsonb_build_object(
        'fields', (
          SELECT jsonb_agg(
            CASE
              WHEN field.value->>'id' IN ('upLightQty', 'ledgeLightQty', 'groundLightQty')
              THEN field.value || jsonb_build_object('required', false)
              ELSE field.value
            END
            ORDER BY field.ordinality
          )
          FROM jsonb_array_elements(step.value->'fields') WITH ORDINALITY AS field(value, ordinality)
        )
      )
      ELSE step.value
    END
    ORDER BY step.ordinality
  )
  FROM jsonb_array_elements(steps) WITH ORDINALITY AS step(value, ordinality)
)
WHERE category = 'Lighting' AND is_active = true;


-- ── 2. Clear description from all calc rules + fix transformer formula ──

UPDATE estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN rule.value->>'product_name' = 'Transformer 150W'
      THEN (rule.value - 'description') || jsonb_build_object(
        'formula', 'Math.ceil(((upLightQty || 0) + (ledgeLightQty || 0) + (groundLightQty || 0)) / 10)'
      )
      ELSE rule.value - 'description'
    END
    ORDER BY rule.ordinality
  )
  FROM jsonb_array_elements(calc_rules) WITH ORDINALITY AS rule(value, ordinality)
)
WHERE category = 'Lighting' AND is_active = true;
