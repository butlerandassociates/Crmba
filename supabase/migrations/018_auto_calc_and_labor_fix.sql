-- ============================================================
-- Migration 018: Auto-calculate rebar/gravel + fix labor cost
-- April 2026
--
-- Fixes:
--   1. Concrete Labor 4"/5" was $6/SF → Jonathan confirmed $7/SF
--      (Migration 011 was written but not applied to DB)
--
--   2. Concrete wizards (v1 + v2): remove manual rebar & gravel
--      entry steps — auto-calculate from square footage:
--        • Rebar:  Math.ceil(squareFootage / 20)  sticks
--        • Gravel: Math.ceil(squareFootage / 160) scoops
--
--   3. Pavers wizard: remove manual "gravelTons" entry step —
--      add "baseDepth" radio select (6/8/10/12 inches) and
--      auto-calculate crushed stone tons from SF × depth.
--      Formula: SF × (depth/12) / 27 × 1.35 (compaction) × 1.35 (density)
-- ============================================================


-- ── 1. Fix Concrete Labor rates: $6 → $7/SF ────────────────────

UPDATE public.products_services
SET labor_cost = 7.00,
    price_per_unit = 7.00 * 1.50,
    description = 'Concrete installation labor — 4-inch pour — $7.00/SF pre-markup'
WHERE name = 'Concrete Labor 4 inch'
  AND labor_cost <> 7.00;

UPDATE public.products_services
SET labor_cost = 7.00,
    price_per_unit = 7.00 * 1.50,
    description = 'Concrete installation labor — 5-inch pour — $7.00/SF pre-markup'
WHERE name = 'Concrete Labor 5 inch'
  AND labor_cost <> 7.00;


-- ── 2. Concrete wizards: remove manual rebar/gravel steps + auto-calc ──
--    Targets both 'Concrete' and 'Concrete v2' categories.

UPDATE public.estimate_templates
SET
  -- Remove the manual rebar and gravel base steps
  steps = (
    SELECT jsonb_agg(step ORDER BY (step->>'id'))
    FROM jsonb_array_elements(steps) AS step
    WHERE step->>'id' NOT IN ('step_rebar', 'step_base')
  ),

  -- Replace manual variable formulas with auto-calculations
  calc_rules = (
    SELECT jsonb_agg(
      CASE
        WHEN rule->>'formula' = 'rebarSticks'
          THEN rule
            || jsonb_build_object('formula', 'Math.ceil(squareFootage / 20)')
            || jsonb_build_object('description', 'Rebar — auto-calc: 1 stick per 20 SF at 2-ft grid')
        WHEN rule->>'formula' = 'scoopCount'
          THEN rule
            || jsonb_build_object('formula', 'Math.ceil(squareFootage / 100)')
            || jsonb_build_object('description', '57-stone gravel base — auto-calc: 1 scoop per 100 SF (1 scoop = 1 ton = 100 SF)')
        ELSE rule
      END
    )
    FROM jsonb_array_elements(calc_rules) AS rule
  )

WHERE category IN ('Concrete', 'Concrete v2')
  AND is_active = true;


-- ── 3. Pavers wizard: auto-calculate crushed stone base ────────────
-- Jonathan confirmed: gravel base depth is ALWAYS 2 inches for pavers.
-- No depth selection needed — formula fixed at 2" depth.
-- Formula: SF × (2/12) / 27 × 1.35 (compaction) × 1.35 (density)

-- Remove the old manual gravelTons step
UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(step)
  FROM jsonb_array_elements(steps) AS step
  WHERE step->>'id' <> 'step_materials'
)
WHERE category = 'Pavers'
  AND is_active = true;

-- Replace manual gravelTons formula with auto-calc at fixed 2" depth
UPDATE public.estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN rule->>'formula' = 'gravelTons'
        THEN rule
          || jsonb_build_object(
               'formula',
               'Math.ceil(squareFootage * (2 / 12) / 27 * 1.35 * 1.35 * 10) / 10'
             )
          || jsonb_build_object(
               'description',
               'Crushed stone base — auto-calc at 2" depth (Jonathan confirmed always 2")'
             )
      ELSE rule
    END
  )
  FROM jsonb_array_elements(calc_rules) AS rule
)
WHERE category = 'Pavers'
  AND is_active = true;
