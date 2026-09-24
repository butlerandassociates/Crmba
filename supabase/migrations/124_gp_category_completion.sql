-- ─────────────────────────────────────────────────────────────────────────────
-- Jonathan (Sep 24 2026, Financial Health follow-up): once a cost category is
-- fully done, its Projected Cost should collapse to the literal Actual, releasing
-- any unspent budget/commitment into Projected GP — instead of the max(Actual,
-- Committed-or-Budget) formula holding it artificially high forever.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS materials_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS labor_complete      boolean NOT NULL DEFAULT false;
