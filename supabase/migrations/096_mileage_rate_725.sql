-- Migration 096: Update mileage reimbursement rate to the IRS rate $0.725/mi
-- Jonathan (Jun 2 2026): "Looks like the IRS mandated amount is $.725"
-- Existing submissions/trips keep their frozen rate; this only affects new uploads.
-- Safe to re-run.

ALTER TABLE public.mileage_settings  ALTER COLUMN rate_per_mile SET DEFAULT 0.725;
ALTER TABLE public.mileage_submissions ALTER COLUMN rate_per_mile SET DEFAULT 0.725;

-- Update the single live settings row so new uploads use $0.725
UPDATE public.mileage_settings SET rate_per_mile = 0.725, updated_at = NOW();
