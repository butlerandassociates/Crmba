-- ============================================================
-- Migration 022: Recovery fix for 021 unique constraint error
-- April 2026
--
-- 021 failed at the rename step because old categories still
-- existed. Fix: delete old empty categories FIRST, then rename.
-- All steps are idempotent — safe to run even if some already ran.
-- ============================================================


-- ════════════════════════════════════════════════════════════
-- CONCRETE
-- ════════════════════════════════════════════════════════════

-- Move any remaining products from old 'Concrete' → 'Concrete v2'
-- (idempotent — skips if already moved)
UPDATE public.products_services
SET category_id = (SELECT id FROM public.service_categories WHERE name = 'Concrete v2' LIMIT 1)
WHERE category_id = (SELECT id FROM public.service_categories WHERE name = 'Concrete' LIMIT 1)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (SELECT id FROM public.service_categories WHERE name = 'Concrete v2' LIMIT 1)
  );

-- Deactivate old 'Concrete' wizard (idempotent)
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Concrete' AND is_active = true;

-- Delete old 'Concrete' category NOW (before rename) — only if empty
DELETE FROM public.service_categories
WHERE name = 'Concrete'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );

-- Now rename 'Concrete v2' → 'Concrete' (no conflict anymore)
UPDATE public.service_categories SET name = 'Concrete' WHERE name = 'Concrete v2';

-- Rename template category
UPDATE public.estimate_templates SET category = 'Concrete' WHERE category = 'Concrete v2';


-- ════════════════════════════════════════════════════════════
-- OUTDOOR KITCHENS
-- ════════════════════════════════════════════════════════════

-- Move products from 'Outdoor Kitchens' → 'Outdoor Kitchen'
UPDATE public.products_services
SET category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1)
WHERE category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchens' LIMIT 1)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1)
  );

-- Move products from 'Outdoor Kitchens v2' → 'Outdoor Kitchen'
UPDATE public.products_services
SET category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1)
WHERE category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchens v2' LIMIT 1)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (SELECT id FROM public.service_categories WHERE name = 'Outdoor Kitchen' LIMIT 1)
  );

-- Deactivate old 'Outdoor Kitchens' wizard
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Outdoor Kitchens' AND is_active = true;

-- Update 'Outdoor Kitchens v2' wizard template → 'Outdoor Kitchen'
UPDATE public.estimate_templates
SET category = 'Outdoor Kitchen'
WHERE category = 'Outdoor Kitchens v2';

-- Delete 'Outdoor Kitchens' category (now empty)
DELETE FROM public.service_categories
WHERE name = 'Outdoor Kitchens'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );

-- Delete 'Outdoor Kitchens v2' category (now empty)
DELETE FROM public.service_categories
WHERE name = 'Outdoor Kitchens v2'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );


-- ════════════════════════════════════════════════════════════
-- PERGOLA / PAVILION
-- ════════════════════════════════════════════════════════════

-- Move products from old 'Pergola/Pavilion' → 'Pergola/Pavilion v2'
UPDATE public.products_services
SET category_id = (SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion v2' LIMIT 1)
WHERE category_id = (SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion' LIMIT 1)
  AND name NOT IN (
    SELECT ps2.name FROM public.products_services ps2
    WHERE ps2.category_id = (SELECT id FROM public.service_categories WHERE name = 'Pergola/Pavilion v2' LIMIT 1)
  );

-- Deactivate old 'Pergola/Pavilion' wizard
UPDATE public.estimate_templates
SET is_active = false
WHERE category = 'Pergola/Pavilion' AND is_active = true;

-- Delete old 'Pergola/Pavilion' category (before rename)
DELETE FROM public.service_categories
WHERE name = 'Pergola/Pavilion'
  AND NOT EXISTS (
    SELECT 1 FROM public.products_services
    WHERE category_id = public.service_categories.id
  );

-- Rename 'Pergola/Pavilion v2' → 'Pergola/Pavilion'
UPDATE public.service_categories SET name = 'Pergola/Pavilion' WHERE name = 'Pergola/Pavilion v2';

-- Rename template category
UPDATE public.estimate_templates SET category = 'Pergola/Pavilion' WHERE category = 'Pergola/Pavilion v2';
