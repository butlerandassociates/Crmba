-- ============================================================
-- Migration 050: Include FIO assigned labor in project financials
-- Butler & Associates CRM
--
-- WHY: Migration 049 only counted PAID crew amounts. But FIO items
--      represent committed labor costs the moment they are created.
--      Jonathan expects GP to reflect committed costs even before
--      the payment is formally recorded.
--
-- Logic change:
--   labor_cost = GREATEST(fio_assigned_total, crew_payments_total)
--   This means: use committed FIO labor as cost by default.
--   Once actual payments exceed committed amount, use actual paid.
--
-- New trigger added: field_installation_order_items
--   Fires when FIO line items are added/edited/deleted so the
--   project financials update immediately when the FIO is built.
-- ============================================================


-- ── UPDATED SHARED FUNCTION ───────────────────────────────────

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

  -- Material + labor receipts entered manually
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

  -- Use whichever is larger: committed FIO labor vs actual paid
  -- Once payments exceed committed amount, actual paid takes over
  v_labor_total  := GREATEST(v_fio_assigned, v_crew_paid);
  v_total_actual := v_receipts_total + v_labor_total;

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


-- ── NEW TRIGGER: field_installation_order_items ───────────────
-- Fires when FIO line items are created/edited/deleted so GP
-- updates the moment the labor schedule is built, not just when
-- payments are recorded.

CREATE OR REPLACE FUNCTION public.trg_fio_items_recalc_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    SELECT project_id INTO v_project_id
      FROM public.field_installation_orders
     WHERE id = OLD.fio_id;
  ELSE
    SELECT project_id INTO v_project_id
      FROM public.field_installation_orders
     WHERE id = NEW.fio_id;
  END IF;

  IF v_project_id IS NOT NULL THEN
    PERFORM public.recalc_project_financials(v_project_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS fio_items_recalc_project_financials ON public.field_installation_order_items;
CREATE TRIGGER fio_items_recalc_project_financials
  AFTER INSERT OR UPDATE OR DELETE
  ON public.field_installation_order_items
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_fio_items_recalc_financials();


-- ── BACKFILL ──────────────────────────────────────────────────
-- Re-run for all projects that have FIO items OR receipts OR
-- crew payments so every stored value reflects the new logic.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT DISTINCT p.id
      FROM public.projects p
     WHERE EXISTS (
             SELECT 1
               FROM public.field_installation_order_items item
               JOIN public.field_installation_orders fio ON fio.id = item.fio_id
              WHERE fio.project_id = p.id
           )
        OR EXISTS (
             SELECT 1 FROM public.project_receipts pr
              WHERE pr.project_id = p.id
           )
        OR EXISTS (
             SELECT 1
               FROM public.fio_crew_payments fcp
               JOIN public.field_installation_orders fio ON fio.id = fcp.fio_id
              WHERE fio.project_id = p.id
           )
  LOOP
    PERFORM public.recalc_project_financials(r.id);
  END LOOP;
END;
$$;
