-- Migration 109: Client Notes on proposals
-- Adds a client-facing "Client Note" that can be attached to a specific line item
-- and/or to a whole category (section). Shown on the proposal PDF + client portal.
-- Separate from the product-level `description`. Safe to re-run.

-- Per line-item client note
ALTER TABLE public.estimate_line_items
  ADD COLUMN IF NOT EXISTS client_note text;

-- Per-category client notes for the estimate, keyed by category name
--   e.g. { "Pavers": "note text", "Concrete": "note text" }
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS category_notes jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.estimate_line_items.client_note IS
  'Client-facing note for this specific line item (shown on the proposal PDF + portal). Separate from product description.';
COMMENT ON COLUMN public.estimates.category_notes IS
  'Client-facing notes per category/section, keyed by category name. Shown under the section header on the proposal PDF + portal.';
