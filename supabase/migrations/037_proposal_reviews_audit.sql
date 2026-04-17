-- 037_proposal_reviews_audit.sql
-- Add audit columns + triggers to proposal_reviews (missed in 034)

ALTER TABLE public.proposal_reviews
  ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS updated_at  timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_proposal_reviews_created_by ON public.proposal_reviews(created_by);
CREATE INDEX IF NOT EXISTS idx_proposal_reviews_updated_by ON public.proposal_reviews(updated_by);

-- INSERT trigger — set created_by from auth.uid() if not already set
DROP TRIGGER IF EXISTS trg_audit_created_proposal_reviews ON public.proposal_reviews;
CREATE TRIGGER trg_audit_created_proposal_reviews
  BEFORE INSERT ON public.proposal_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_audit_created_by();

-- UPDATE trigger — always set updated_by + updated_at
DROP TRIGGER IF EXISTS trg_audit_updated_proposal_reviews ON public.proposal_reviews;
CREATE TRIGGER trg_audit_updated_proposal_reviews
  BEFORE UPDATE ON public.proposal_reviews
  FOR EACH ROW EXECUTE FUNCTION fn_audit_updated_by();

-- Backfill existing rows
UPDATE public.proposal_reviews
  SET created_by = '8c968e27-d01e-433e-b290-82d2a5c949a1'
  WHERE created_by IS NULL;
