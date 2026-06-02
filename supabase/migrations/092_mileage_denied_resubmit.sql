-- Migration 092: Let employees fix & resubmit a DENIED submission (same week)
-- Confirmed by Jonathan Jun 2 2026: when a submission is denied, the employee
-- fixes it and resubmits the SAME submission before the Thursday 2pm cutoff.
--
-- The migration 089 UPDATE policies gate editing to status = 'draft', so a denied
-- submission (status = 'denied') is currently locked. Widen USING to also allow
-- 'denied' so the employee can reopen it (denied → draft) and edit its trips again.
-- WITH CHECK still only ensures the row stays theirs.
-- Safe to re-run.

DROP POLICY IF EXISTS "mileage_submissions_own_upd" ON public.mileage_submissions;

CREATE POLICY "mileage_submissions_own_upd" ON public.mileage_submissions
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('draft', 'denied'))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mileage_trips_own_upd" ON public.mileage_trips;

CREATE POLICY "mileage_trips_own_upd" ON public.mileage_trips
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('draft', 'denied')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));

-- Allow employees to INSERT trips onto a denied submission they are fixing (was draft-only).
DROP POLICY IF EXISTS "mileage_trips_own_ins" ON public.mileage_trips;

CREATE POLICY "mileage_trips_own_ins" ON public.mileage_trips
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('draft', 'denied')
  ));
