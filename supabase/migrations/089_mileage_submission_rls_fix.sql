-- Migration 089: Fix mileage_submissions UPDATE RLS so employees can submit their draft.
--
-- Bug: the original policy used only USING (user_id = auth.uid() AND status = 'draft').
-- With no WITH CHECK, Postgres applies the USING expression to the NEW row too.
-- Submitting changes status draft → submitted, so the new row fails "status = 'draft'"
-- → "new row violates row-level security policy for table mileage_submissions".
--
-- Fix: USING gates the OLD row (must be the employee's own draft);
--      WITH CHECK gates the NEW row (must still belong to the employee — status may change).
-- Safe to re-run.

DROP POLICY IF EXISTS "mileage_submissions_own_upd" ON public.mileage_submissions;

CREATE POLICY "mileage_submissions_own_upd" ON public.mileage_submissions
  FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft')
  WITH CHECK (user_id = auth.uid());

-- Same latent issue on the trips table: employees edit trips on their own DRAFT submission.
-- The original used only USING; add WITH CHECK so row mutations (project assignment, etc.) pass.
DROP POLICY IF EXISTS "mileage_trips_own_upd" ON public.mileage_trips;

CREATE POLICY "mileage_trips_own_upd" ON public.mileage_trips
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status = 'draft'
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));
