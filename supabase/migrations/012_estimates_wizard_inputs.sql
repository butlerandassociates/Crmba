-- ============================================================
-- Migration 012: Add wizard_inputs to estimates
-- Stores the form selections made in each wizard per category
-- so the wizard can be re-opened pre-filled when editing.
-- Format: { "Concrete": { projectType, squareFootage, ... },
--           "Pavers":   { squareFootage, gravelTons, ... } }
-- ============================================================

ALTER TABLE public.estimates
ADD COLUMN IF NOT EXISTS wizard_inputs jsonb NOT NULL DEFAULT '{}'::jsonb;
