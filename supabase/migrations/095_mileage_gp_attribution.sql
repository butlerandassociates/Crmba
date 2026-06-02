-- ============================================================
-- Migration 095: Attribute mileage reimbursement to project GP$
-- Butler & Associates CRM
--
-- WHY (Jonathan, Jun 2 2026): "costs associated with the trips that are
--   being attributed to specific jobs need to be attributed to the GP$.
--   These act as costs to the job like normal cost attributes."
--
-- WHAT: recalc_project_financials() now adds a mileage cost term:
--   the payout of every mileage trip that is attributed to the project,
--   belongs to an APPROVED or PAID submission, and is not denied/personal.
--   This equals the employee's reimbursed amount for that job → reduces GP$.
--
--   gross_profit = total_value − (receipts + labor + mileage)
--
-- Triggers added so GP$ updates live when trips/submissions change
-- (reassign, approve, pay, deny, mark personal, etc.).
-- Safe to re-run.
-- ============================================================

CREATE OR REPLACE FUNCTION public.recalc_project_financials(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_value    NUMERIC;
  v_receipts_total NUMERIC;
  v_fio_assigned   NUMERIC;
  v_crew_paid      NUMERIC;
  v_labor_total    NUMERIC;
  v_mileage_total  NUMERIC;
  v_total_actual   NUMERIC;
  v_gross_profit   NUMERIC;
  v_margin         NUMERIC;
BEGIN
  SELECT total_value INTO v_total_value
    FROM public.projects
   WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Material + labor receipts entered manually (a.k.a. cost attributions)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_receipts_total
    FROM public.project_receipts
   WHERE project_id = p_id;

  -- FIO assigned labor: committed cost from line items
  SELECT COALESCE(SUM(item.total_labor), 0)
    INTO v_fio_assigned
    FROM public.field_installation_order_items item
    JOIN public.field_installation_orders fio ON fio.id = item.fio_id
   WHERE fio.project_id = p_id;

  -- Actual crew payments recorded in the app
  SELECT COALESCE(SUM(fcp.amount_paid), 0)
    INTO v_crew_paid
    FROM public.fio_crew_payments fcp
    JOIN public.field_installation_orders fio ON fio.id = fcp.fio_id
   WHERE fio.project_id = p_id;

  v_labor_total := GREATEST(v_fio_assigned, v_crew_paid);

  -- Mileage attributed to this job: reimbursed payout of approved/paid,
  -- non-denied, non-personal trips assigned to the project.
  SELECT COALESCE(SUM(t.payout), 0)
    INTO v_mileage_total
    FROM public.mileage_trips t
    JOIN public.mileage_submissions s ON s.id = t.submission_id
   WHERE t.project_id  = p_id
     AND t.is_active    = true
     AND t.is_personal  = false
     AND t.status      <> 'denied'
     AND s.is_active    = true
     AND s.status       IN ('approved', 'paid');

  v_total_actual := v_receipts_total + v_labor_total + v_mileage_total;

  IF v_total_actual > 0 THEN
    v_gross_profit := v_total_value - v_total_actual;
    v_margin := CASE
                  WHEN v_total_value > 0
                  THEN ROUND((v_gross_profit / v_total_value) * 100, 2)
                  ELSE 0
                END;

    UPDATE public.projects
       SET total_costs   = v_total_actual,
           gross_profit  = v_gross_profit,
           profit_margin = v_margin,
           updated_at    = NOW()
     WHERE id = p_id;
  END IF;
END;
$$;

-- ── TRIGGER: mileage_trips → recalc the affected project(s) ──
CREATE OR REPLACE FUNCTION public.trg_mileage_trip_recalc_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.project_id IS NOT NULL THEN PERFORM public.recalc_project_financials(OLD.project_id); END IF;
    RETURN OLD;
  END IF;

  IF NEW.project_id IS NOT NULL THEN PERFORM public.recalc_project_financials(NEW.project_id); END IF;
  -- If the trip was reassigned to a different project, refresh the old one too
  IF TG_OP = 'UPDATE' AND OLD.project_id IS DISTINCT FROM NEW.project_id AND OLD.project_id IS NOT NULL THEN
    PERFORM public.recalc_project_financials(OLD.project_id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mileage_trips_recalc_project_financials ON public.mileage_trips;
CREATE TRIGGER mileage_trips_recalc_project_financials
  AFTER INSERT OR UPDATE OR DELETE
  ON public.mileage_trips
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mileage_trip_recalc_financials();

-- ── TRIGGER: mileage_submissions status change → recalc its trips' projects ──
-- Approving/paying/denying a submission flips whether its trips count as cost.
CREATE OR REPLACE FUNCTION public.trg_mileage_submission_recalc_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  r RECORD;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;  -- status unchanged → no cost-eligibility change
  END IF;
  FOR r IN
    SELECT DISTINCT project_id
      FROM public.mileage_trips
     WHERE submission_id = NEW.id
       AND project_id IS NOT NULL
  LOOP
    PERFORM public.recalc_project_financials(r.project_id);
  END LOOP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS mileage_subs_recalc_project_financials ON public.mileage_submissions;
CREATE TRIGGER mileage_subs_recalc_project_financials
  AFTER UPDATE
  ON public.mileage_submissions
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_mileage_submission_recalc_financials();

-- ── BACKFILL: refresh every project that already has qualifying mileage ──
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT t.project_id AS id
      FROM public.mileage_trips t
      JOIN public.mileage_submissions s ON s.id = t.submission_id
     WHERE t.project_id IS NOT NULL
       AND t.is_active   = true
       AND t.is_personal = false
       AND t.status     <> 'denied'
       AND s.is_active   = true
       AND s.status      IN ('approved', 'paid')
  LOOP
    PERFORM public.recalc_project_financials(r.id);
  END LOOP;
END $$;
