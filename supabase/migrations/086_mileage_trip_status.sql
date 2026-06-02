-- Migration 086: Per-trip approve/deny status on mileage_trips
-- Lets admins approve/deny individual trips within a submission.
-- Safe to re-run.

ALTER TABLE public.mileage_trips
  ADD COLUMN IF NOT EXISTS status        text NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'denied')),
  ADD COLUMN IF NOT EXISTS denial_reason text;

COMMENT ON COLUMN public.mileage_trips.status        IS 'Per-trip review state — pending/approved/denied. Denied trips are excluded from the submission payout total.';
COMMENT ON COLUMN public.mileage_trips.denial_reason IS 'Optional reason shown when a single trip is denied';

CREATE INDEX IF NOT EXISTS idx_mileage_trips_status ON public.mileage_trips(status);

-- Backfill: trips already inside approved submissions become approved
UPDATE public.mileage_trips t
  SET status = 'approved'
  FROM public.mileage_submissions s
  WHERE t.submission_id = s.id
    AND s.status = 'approved'
    AND t.status = 'pending';
