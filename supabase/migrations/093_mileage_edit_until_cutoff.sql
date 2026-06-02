-- Migration 093: Let employees keep adding/editing trips until the Thursday cutoff
-- Confirmed by Jonathan Jun 2 2026: "they can continue uploading until cutoff"
-- (e.g. forgot a couple trips and upload a second CSV after already submitting).
--
-- Migration 092 allowed editing on status IN ('draft','denied'). Widen to also
-- include 'submitted' so a submitted week can still receive more trips / edits
-- before the Thursday 2pm cutoff. The cutoff itself is enforced in the UI
-- (submission_deadline timestamp); approved/paid stay locked.
-- Safe to re-run.

DROP POLICY IF EXISTS "mileage_submissions_own_upd" ON public.mileage_submissions;

CREATE POLICY "mileage_submissions_own_upd" ON public.mileage_submissions
  FOR UPDATE
  USING (user_id = auth.uid() AND status IN ('draft', 'submitted', 'denied'))
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "mileage_trips_own_upd" ON public.mileage_trips;

CREATE POLICY "mileage_trips_own_upd" ON public.mileage_trips
  FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('draft', 'submitted', 'denied')
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid()
  ));

DROP POLICY IF EXISTS "mileage_trips_own_ins" ON public.mileage_trips;

CREATE POLICY "mileage_trips_own_ins" ON public.mileage_trips
  FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.mileage_submissions s
    WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status IN ('draft', 'submitted', 'denied')
  ));
