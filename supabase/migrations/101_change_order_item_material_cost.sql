-- ============================================================
-- Migration 101: Track material cost on change-order items
-- Butler & Associates CRM
--
-- WHY (Jonathan, Jun 6 2026): change-order tax should be 9% on the change
--   order's MATERIALS (like proposals), so that when a CO is approved + merged
--   the proposal's tax stays accurate. CO items previously stored only the
--   client unit price, with no material breakdown — so tax couldn't be computed
--   per-material. This adds the per-unit material cost (auto-filled when a CO
--   line item is created from a product).
-- Safe / idempotent.
-- ============================================================

ALTER TABLE public.change_order_items
  ADD COLUMN IF NOT EXISTS material_cost numeric(12,2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.change_order_items.material_cost IS
  'Per-unit material cost (from the linked product). Used to compute 9%-on-materials sales tax on merge.';
