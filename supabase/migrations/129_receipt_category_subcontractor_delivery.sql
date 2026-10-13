-- ─────────────────────────────────────────────────────────────────────────────
-- Cost Attributions: receipts can be Subcontractor or Delivery, not just Material / Labor.
--
-- Jonathan (Oct 14 2026): sometimes a one-off person is paid without an FIO (e.g. Hyper Hauling
-- bringing gravel) — that should be tracked as a Subcontractor cost instead of being forced into
-- Material — and delivery fees need their own category (Delivery is also a category sold in
-- proposals). project_receipts.category was restricted by a CHECK to ('material','labor'), which
-- would reject the new values, so the constraint is widened.
--
-- Existing rows are all 'material' / 'labor', so re-adding the constraint validates instantly and
-- changes nothing. GP: the app counts delivery as material cost and subcontractor as labor cost;
-- the DB trigger recalc_project_financials (049/050) sums every receipt regardless of category,
-- so it needs no change.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.project_receipts DROP CONSTRAINT IF EXISTS project_receipts_category_check;
ALTER TABLE public.project_receipts
  ADD CONSTRAINT project_receipts_category_check
  CHECK (category = ANY (ARRAY['material'::text, 'labor'::text, 'subcontractor'::text, 'delivery'::text]));
