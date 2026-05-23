-- Migration 076: Paver Wizard — Edge Restraint as conditional question
--
-- Before: Edge Restraint always added at squareFootage SF (no question asked)
-- After:
--   Step "Site Conditions" gets a new Yes/No radio: "Edge Restraint required?"
--   New conditional step "Edge Restraint" (shown only when Yes) asks for linear feet
--   Edge Restraint calc rule now conditional + uses edgeRestraintLF with unit LF

-- ── 1. Add needsEdgeRestraint radio to step_site ─────────────────
--    Inserts between demoRequired (ord 2) and deliveryLoadsOverride (ord 4)

UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(
    CASE
      WHEN step->>'id' = 'step_site'
        THEN jsonb_set(
          step,
          '{fields}',
          (
            SELECT jsonb_agg(field ORDER BY ord)
            FROM (
              SELECT field,
                     CASE field->>'id'
                       WHEN 'difficultAccess'      THEN 1
                       WHEN 'demoRequired'          THEN 2
                       WHEN 'deliveryLoadsOverride' THEN 4
                       ELSE 10
                     END AS ord
              FROM jsonb_array_elements(step->'fields') AS field
              UNION ALL
              SELECT '{
                "id": "needsEdgeRestraint",
                "type": "radio",
                "label": "Edge Restraint required?",
                "required": true,
                "options": ["Yes", "No"],
                "help_text": "Rigid plastic edge restraint locks pavers along the perimeter. Charged per linear foot."
              }'::jsonb, 3
            ) sub
          )
        )
      ELSE step
    END
  )
  FROM jsonb_array_elements(steps) AS step
)
WHERE category = 'Pavers'
  AND is_active = true
  AND steps::text NOT LIKE '%needsEdgeRestraint%';


-- ── 2. Insert step_edge_restraint between step_site (ord 3) and step_demo (ord 5) ──

UPDATE public.estimate_templates
SET steps = (
  SELECT jsonb_agg(step ORDER BY ord)
  FROM (
    SELECT step,
           CASE step->>'id'
             WHEN 'step_project'   THEN 1
             WHEN 'step_materials' THEN 2
             WHEN 'step_site'      THEN 3
             WHEN 'step_demo'      THEN 5
             ELSE 10
           END AS ord
    FROM jsonb_array_elements(steps) AS step
    UNION ALL
    SELECT '{
      "id": "step_edge_restraint",
      "title": "Edge Restraint",
      "conditional_on": { "field_id": "needsEdgeRestraint", "value": "Yes" },
      "fields": [
        {
          "id": "edgeRestraintLF",
          "type": "number",
          "label": "Edge Restraint Length (linear feet)",
          "required": true,
          "placeholder": "e.g. 80",
          "help_text": "Total perimeter of the paver area that needs edge restraint."
        }
      ]
    }'::jsonb, 4
  ) sub
)
WHERE category = 'Pavers'
  AND is_active = true
  AND steps::text NOT LIKE '%step_edge_restraint%';


-- ── 3. Update Edge Restraint calc rule: conditional + LF ──────────
--    Overwrites formula, unit, description, adds conditional fields

UPDATE public.estimate_templates
SET calc_rules = (
  SELECT jsonb_agg(
    CASE
      WHEN rule->>'product_name' = 'Edge Restraint'
        THEN rule || '{
          "description": "Rigid plastic edge restraint — charged per linear foot of perimeter",
          "formula": "edgeRestraintLF",
          "unit": "LF",
          "conditional_field_id": "needsEdgeRestraint",
          "conditional_value": "Yes"
        }'::jsonb
      ELSE rule
    END
  )
  FROM jsonb_array_elements(calc_rules) AS rule
)
WHERE category = 'Pavers'
  AND is_active = true
  AND calc_rules::text NOT LIKE '%edgeRestraintLF%';
