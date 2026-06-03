-- ============================================================
-- Migration 098: Enforce Friday-start mileage periods
-- Butler & Associates CRM
--
-- WHY: pay weeks run Friday → Thursday (Jonathan, Jun 2 2026). Legacy rows
--   with a non-Friday week_start (e.g. the old Monday/Thursday-start periods)
--   overlapped the correct Friday period and caused the employee "My Mileage"
--   view to resolve a DIFFERENT period than the admin upload — trips showed in
--   "My History" but not "My Mileage". Code now picks the latest-start period
--   covering today on both sides; this migration removes the bad rows and adds
--   a guard so they can never be inserted again.
--
-- SAFE: deleting a period cascades to its submissions/trips, but the only rows
--   removed here are non-Friday periods (legacy/empty). The canonical
--   Friday-start period and its trips are untouched. Idempotent / re-runnable.
-- ============================================================

-- 1. Purge any period whose week does NOT start on a Friday (EXTRACT DOW: 5 = Fri).
--    Cascades to their submissions + trips (legacy/empty rows only).
DELETE FROM public.mileage_periods
WHERE EXTRACT(DOW FROM week_start) <> 5;

-- 2. Add a CHECK constraint so only Friday-start periods can ever be inserted.
--    ensureCurrentPeriod() always computes a Friday start, so this never blocks
--    normal operation. Guarded with a DO block for idempotency (CHECK constraints
--    don't support ADD CONSTRAINT IF NOT EXISTS).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'mileage_periods_week_start_friday'
      AND conrelid = 'public.mileage_periods'::regclass
  ) THEN
    ALTER TABLE public.mileage_periods
      ADD CONSTRAINT mileage_periods_week_start_friday
      CHECK (EXTRACT(DOW FROM week_start) = 5);
  END IF;
END $$;

COMMENT ON CONSTRAINT mileage_periods_week_start_friday ON public.mileage_periods
  IS 'Pay weeks run Friday→Thursday — week_start must fall on a Friday (DOW 5)';
