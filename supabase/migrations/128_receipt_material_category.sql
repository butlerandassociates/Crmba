-- ─────────────────────────────────────────────────────────────────────────────
-- Cost Attributions: attribute each material receipt to a sold material category.
--
-- Jonathan (Oct 12-13 2026): the Cost Attributions tool should show, per material category
-- sold on the job (Concrete, Pavers, ...), how much has actually been spent against what was
-- expected (the sold line items' material cost). A receipt therefore needs to say which sold
-- category it belongs to.
--
-- Purely additive: one nullable text column. Existing receipts stay NULL ("Unattributed")
-- until someone tags them in the tool; nothing about how project costs / GP are computed
-- changes (triggers 049/050 only sum amount by category = material/labor).
-- The value is the sold line items' category name, or 'Other / General' for receipts that
-- don't map to one sold category.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_receipts
  ADD COLUMN IF NOT EXISTS material_category text;
