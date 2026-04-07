-- ============================================================
-- Migration 021: Remove duplicate categories + rename v2 → clean names
-- April 2026 — run AFTER migrations 017–020
--
-- Actions:
--   Concrete:
--     • Move products from old 'Concrete' → 'Concrete v2'
--     • Deactivate old 'Concrete' wizard template
--     • Rename 'Concrete v2' category + template → 'Concrete'
--     • Delete old empty 'Concrete' service_category
--
--   Outdoor Kitchens → all consolidate into 'Outdoor Kitchen' (singular):
--     • Move products from 'Outdoor Kitchens' → 'Outdoor Kitchen'
--     • Move products from 'Outdoor Kitchens v2' → 'Outdoor Kitchen'
--     • Deactivate old 'Outdoor Kitchens' wizard template
--     • Update 'Outdoor Kitchens v2' wizard template category → 'Outdoor Kitchen'
--     • Delete 'Outdoor Kitchens' service_category (now empty)
--     • Delete 'Outdoor Kitchens v2' service_category (now empty)
--
--   Pergola/Pavilion:
--     • Move products from old 'Pergola/Pavilion' → 'Pergola/Pavilion v2'
--     • Deactivate old 'Pergola/Pavilion' wizard template
--     • Rename 'Pergola/Pavilion v2' category + template → 'Pergola/Pavilion'
--     • Delete old empty 'Pergola/Pavilion' service_category
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- CONCRETE
-- ════════════════════════════════════════════════════════════

-- 1a. Move products from old 'Concrete' → 'Concrete v2'
--     Skip if a product with the same name already exists in v2 (keep v2 version)
UPDATE public.products_services
SET category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Concrete v2' LIMIT 1
)
WHERE category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Concrete' LIMIT 1
)
  AND name NOT IN (
    SELECT ps2.name
    FROM public.products_services ps2
    WHERE ps2.category_id = (
      SELECT id FROM public.service_categories WHERE name = 'Concrete v2' LIMIT 1
    )
  );

-- 1b. Deactivate old 'Concrete' wizard template
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Concrete'
  AND is_active = true;

-- 1c. Rename 'Concrete v2' service_category → 'Concrete'
UPDATE public.service_categories
SET name = 'Concrete'
WHERE name = 'Concrete v2';

-- 1d. Rename estimate_templates.category 'Concrete v2' → 'Concrete'
UPDATE public.estimate_templates
SET category = 'Concrete'
WHERE category = 'Concrete v2';

-- 1e. Delete old empty 'Concrete' service_category
DELETE FROM public.service_categories
WHERE name = 'Concrete'
  AND id <> (
    SELECT id FROM public.service_categories WHERE name = 'Concrete' LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );


-- ════════════════════════════════════════════════════════════
-- OUTDOOR KITCHENS — all consolidate into 'Outdoor Kitchen' (singular)
-- ════════════════════════════════════════════════════════════

-- 2a. Move products from 'Outdoor Kitchens' (plural, old) → 'Outdoor Kitchen' (singular)
--     Skip duplicates — keep what's already in Outdoor Kitchen
UPDATE public.products_services
SET category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1
)
WHERE category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchens' LIMIT 1
)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (
      SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1
    )
  );

-- 2b. Move products from 'Outdoor Kitchens v2' → 'Outdoor Kitchen' (singular)
--     Skip duplicates — keep what's already in Outdoor Kitchen
UPDATE public.products_services
SET category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1
)
WHERE category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchens v2' LIMIT 1
)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (
      SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1
    )
  );

-- 2c. Deactivate old 'Outdoor Kitchens' wizard template
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Outdoor Kitchens'
  AND is_active = true;

-- 2d. Update 'Outdoor Kitchens v2' wizard template → 'Outdoor Kitchen'
UPDATE public.estimate_templates
SET category = 'Outdoor Kitchen'
WHERE category = 'Outdoor Kitchens v2';

-- 2e. Delete 'Outdoor Kitchens' service_category (now empty)
DELETE FROM public.service_categories
WHERE name = 'Outdoor Kitchens'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );

-- 2f. Delete 'Outdoor Kitchens v2' service_category (now empty)
DELETE FROM public.service_categories
WHERE name = 'Outdoor Kitchens v2'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );


-- ════════════════════════════════════════════════════════════
-- PERGOLA / PAVILION
-- ════════════════════════════════════════════════════════════

-- 3a. Move products from old 'Pergola/Pavilion' → 'Pergola/Pavilion v2'
--     Skip if a product with the same name already exists in v2
UPDATE public.products_services
SET category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion v2' LIMIT 1
)
WHERE category_id = (
  SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion' LIMIT 1
)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (
      SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion v2' LIMIT 1
    )
  );

-- 3b. Deactivate old 'Pergola/Pavilion' wizard template
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Pergola/Pavilion'
  AND is_active = true;

-- 3c. Rename 'Pergola/Pavilion v2' service_category → 'Pergola/Pavilion'
UPDATE public.service_categories
SET name = 'Pergola/Pavilion'
WHERE name = 'Pergola/Pavilion v2';

-- 3d. Rename estimate_templates.category 'Pergola/Pavilion v2' → 'Pergola/Pavilion'
UPDATE public.estimate_templates
SET category = 'Pergola/Pavilion'
WHERE category = 'Pergola/Pavilion v2';

-- 3e. Delete old empty 'Pergola/Pavilion' service_category
DELETE FROM public.service_categories
WHERE name = 'Pergola/Pavilion'
  AND id <> (
    SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion' LIMIT 1
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );
