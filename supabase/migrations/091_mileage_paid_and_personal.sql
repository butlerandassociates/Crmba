-- Migration 091: Manual "Mark as Paid" + Personal-trip exclusion
-- Confirmed by Jonathan Jun 2 2026:
--   - Getting paid is a MANUAL step: after approving, admin clicks "Mark as Paid"
--     (NOT auto-paid on the Friday pay date). So submissions get a 'paid' state.
--   - Employees can log a personal / non-project trip and mark it "Personal";
--     it stays logged for the record but is EXCLUDED from the payout/report.
-- Safe to re-run.

-- ─── 1. Submissions: add 'paid' status + paid audit columns ─────────────────
-- Drop the old status CHECK and re-add it including 'paid'.
ALTER TABLE public.mileage_submissions
  DROP CONSTRAINT IF EXISTS mileage_submissions_status_check;

ALTER TABLE public.mileage_submissions
  ADD CONSTRAINT mileage_submissions_status_check
  CHECK (status IN ('draft', 'submitted', 'approved', 'denied', 'paid'));

ALTER TABLE public.mileage_submissions
  ADD COLUMN IF NOT EXISTS paid_at timestamptz,
  ADD COLUMN IF NOT EXISTS paid_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.mileage_submissions.paid_at IS 'Set when admin manually marks the approved submission Paid';
COMMENT ON COLUMN public.mileage_submissions.paid_by IS 'Admin who clicked Mark as Paid';

-- ─── 2. Trips: personal flag (logged but excluded from payout) ──────────────
ALTER TABLE public.mileage_trips
  ADD COLUMN IF NOT EXISTS is_personal boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.mileage_trips.is_personal IS 'True = personal/non-project trip — kept for the record but excluded from the payout total and report';

CREATE INDEX IF NOT EXISTS idx_mileage_trips_personal ON public.mileage_trips(is_personal);

-- ─── 3. RLS: allow employee to mark Paid? No — paid is admin-only.            ─
-- The existing "mileage_submissions_admin" FOR ALL policy already lets admins
-- update status to 'paid'. The employee UPDATE policy is gated to status='draft',
-- so employees cannot touch paid/approved rows. No policy change needed.
