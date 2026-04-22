-- ============================================================
-- Migration 049: Auto-update project financials on cost changes
-- Butler & Associates CRM
--
-- WHY: projects.total_costs / gross_profit / profit_margin are
--      written once at move-to-sold from proposal estimates and
--      never updated.  When crew payments (fio_crew_payments) or
--      manual receipts (project_receipts) are recorded the stored
--      values become stale.  These triggers recalculate the three
--      columns automatically on every relevant write so every part
--      of the UI (Dashboard, Financials, P&L, client detail) stays
--      accurate without any frontend changes.
--
-- Tables covered:
--   project_receipts   → project_id direct
--   fio_crew_payments  → project_id via field_installation_orders
--
-- Behaviour: recalculation only runs when actual spend > 0.
--   This preserves the original estimated values from move-to-sold
--   for projects that have not recorded any costs yet.
-- ============================================================


-- ── SHARED RECALCULATION FUNCTION ────────────────────────────

CREATE OR REPLACE FUNCTION public.recalc_project_financials(p_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_value    NUMERIC;
  v_receipts_total NUMERIC;
  v_crew_total     NUMERIC;
  v_total_actual   NUMERIC;
  v_gross_profit   NUMERIC;
  v_margin         NUMERIC;
BEGIN
  -- Fetch the contract value (set at move-to-sold, never changes)
  SELECT total_value INTO v_total_value
    FROM public.projects
   WHERE id = p_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Sum all project receipts (both material and labor categories)
  SELECT COALESCE(SUM(amount), 0)
    INTO v_receipts_total
    FROM public.project_receipts
   WHERE project_id = p_id;

  -- Sum all FIO crew payments linked to this project
  -- fio_crew_payments → field_installation_orders → projects
  SELECT COALESCE(SUM(fcp.amount_paid), 0)
    INTO v_crew_total
    FROM public.fio_crew_payments  fcp
    JOIN public.field_installation_orders fio ON fio.id = fcp.fio_id
   WHERE fio.project_id = p_id;

  v_total_actual := v_receipts_total + v_crew_total;

  -- Only overwrite when actual spend exists.
  -- If all costs are later deleted this guard keeps the original
  -- proposal estimate intact rather than writing $0.
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


-- ── TRIGGER: project_receipts ─────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_receipts_recalc_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_project_financials(OLD.project_id);
  ELSE
    PERFORM public.recalc_project_financials(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS receipts_recalc_project_financials ON public.project_receipts;
CREATE TRIGGER receipts_recalc_project_financials
  AFTER INSERT OR UPDATE OR DELETE
  ON public.project_receipts
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_receipts_recalc_financials();


-- ── TRIGGER: fio_crew_payments ────────────────────────────────

CREATE OR REPLACE FUNCTION public.trg_crew_payments_recalc_financials()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_project_id UUID;
BEGIN
  -- Resolve project_id through field_installation_orders
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

DROP TRIGGER IF EXISTS crew_payments_recalc_project_financials ON public.fio_crew_payments;
CREATE TRIGGER crew_payments_recalc_project_financials
  AFTER INSERT OR UPDATE OR DELETE
  ON public.fio_crew_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.trg_crew_payments_recalc_financials();


-- ── ONE-TIME BACKFILL ─────────────────────────────────────────
-- Recalculate all existing projects that have actual spend so
-- the stored values are correct from the moment this runs.

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    -- Only projects that have at least one receipt or crew payment
    SELECT DISTINCT p.id
      FROM public.projects p
     WHERE EXISTS (
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
