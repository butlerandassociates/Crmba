-- ============================================================
-- PROPOSAL REVIEWS
-- Admin-managed reviews shown on proposal PDF (Option B)
-- ============================================================

CREATE TABLE public.proposal_reviews (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  reviewer_name TEXT        NOT NULL,
  rating       INTEGER     NOT NULL DEFAULT 5 CHECK (rating BETWEEN 1 AND 5),
  review_text  TEXT        NOT NULL,
  sort_order   INTEGER     NOT NULL DEFAULT 0,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  created_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by   UUID        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at on row change
CREATE TRIGGER set_proposal_reviews_updated_at
  BEFORE UPDATE ON public.proposal_reviews
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.proposal_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "proposal_reviews_read" ON public.proposal_reviews
  FOR SELECT USING (public.is_authenticated());

CREATE POLICY "proposal_reviews_admin_write" ON public.proposal_reviews
  FOR ALL USING (public.is_admin());

-- Index for ordered display
CREATE INDEX idx_proposal_reviews_sort ON public.proposal_reviews(sort_order, is_active);

-- Seed with the 3 existing hardcoded reviews from the proposal PDF
INSERT INTO public.proposal_reviews (reviewer_name, rating, review_text, sort_order, is_active) VALUES
(
  'Dan Ordonez',
  5,
  'The crew and Jonathan, the general manager, did an amazing job! Their prices are extremely competitive and the transparency of the quote were the main reason why I chose them. Jonathan was flexible with all the changes and adjustments we had. Communication throughout was excellent. Highly recommend.',
  1,
  TRUE
),
(
  'Drew "Smith" Mills',
  5,
  'Jonathan and his team are some of the most professional and friendly people I''ve had the pleasure of working with in this industry. They were thoughtful in their design and layout, making sure everything matched exactly what we were looking for.',
  2,
  TRUE
),
(
  'B Robey',
  5,
  'Jonathan was incredibly responsive — returned my call immediately and performed a thorough walkthrough, listening to my ideas while providing expert recommendations. Within a day, we were reviewing the invoice and tweaking the design. Highly recommend.',
  3,
  TRUE
);
