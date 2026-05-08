-- ============================================================
-- Migration 058: Commission Engine + Full Audit Columns
-- Jonathan confirmed answers (May 4 2026):
--   Q1: is_deposit checkbox (no PM prepay)
--   Q2: PO approved_by/at
--   Q3: Commission auto-create + pending review
-- Also adds: stage timestamps on projects, profile deactivation,
-- commission approval, estimate accepted/declined by,
-- FIO completed by/at, notifications recipient_id,
-- and project_team_assignments history table.
-- ============================================================

-- ── 1. project_team_assignments (full assignment history) ────
CREATE TABLE IF NOT EXISTS public.project_team_assignments (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  client_id     uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  role          text        NOT NULL CHECK (role IN ('pm', 'foreman', 'sales_rep')),
  profile_id    uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_at   timestamptz NOT NULL DEFAULT now(),
  assigned_by   uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  unassigned_at timestamptz,
  unassigned_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  created_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  updated_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_pta_project_id      ON public.project_team_assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_pta_profile_id      ON public.project_team_assignments(profile_id);
CREATE INDEX IF NOT EXISTS idx_pta_role            ON public.project_team_assignments(role);
-- composite: "find current PM/Foreman/Sales Rep for project X"
CREATE INDEX IF NOT EXISTS idx_pta_project_role    ON public.project_team_assignments(project_id, role);
CREATE INDEX IF NOT EXISTS idx_pta_unassigned_at   ON public.project_team_assignments(unassigned_at);


-- ── 2. project_payments: is_deposit + paid_by ───────────────
ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS is_deposit boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS paid_by    uuid    REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── 3. clients: selling_at + selling_by ─────────────────────
-- prospect_at = clients.created_at (already exists)
-- selling_at = when admin moved the client from prospect → selling
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS selling_at timestamptz,
  ADD COLUMN IF NOT EXISTS selling_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── 4. profiles: deactivated_at + deactivated_by ────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS deactivated_at timestamptz,
  ADD COLUMN IF NOT EXISTS deactivated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── 5. purchase_orders: approved_by + approved_at ───────────
ALTER TABLE public.purchase_orders
  ADD COLUMN IF NOT EXISTS approved_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;


-- ── 6. change_orders: approved_by + approved_at ─────────────
ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS approved_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;


-- ── 7. projects: stage timestamps ───────────────────────────
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS sold_at        timestamptz,
  ADD COLUMN IF NOT EXISTS sold_by        uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS scheduled_at   timestamptz,
  ADD COLUMN IF NOT EXISTS scheduled_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active_at      timestamptz,
  ADD COLUMN IF NOT EXISTS active_by      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at   timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── 8. notifications: recipient_id (per-user targeting) ─────
ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS recipient_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON public.notifications(recipient_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read   ON public.notifications(is_read);

-- Update getUnread to filter by recipient_id once wired in the API.
-- For now the column exists; existing rows have recipient_id = NULL
-- which means "broadcast to all admins" (backwards compatible).


-- ── 9. commission_payments: approved_by + approved_at ───────
-- Jonathan confirmed: system auto-creates pending entries,
-- Jonathan approves from Payroll → editable before approval.
ALTER TABLE public.commission_payments
  ADD COLUMN IF NOT EXISTS approved_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz;


-- ── 10. estimates: accepted_by + declined_by ────────────────
ALTER TABLE public.estimates
  ADD COLUMN IF NOT EXISTS accepted_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS declined_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── 11. field_installation_orders: completed_by + completed_at
ALTER TABLE public.field_installation_orders
  ADD COLUMN IF NOT EXISTS completed_by uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz;


-- ── 12. Trigger coverage for new table ──────────────────────

CREATE OR REPLACE TRIGGER trg_project_team_assignments_created_by
  BEFORE INSERT ON public.project_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by();

CREATE OR REPLACE TRIGGER trg_project_team_assignments_audit_updated
  BEFORE UPDATE ON public.project_team_assignments
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by();


-- ── 13. Indexes for new columns on existing tables ──────────
-- projects stage timestamps — hit by dashboard date range queries
CREATE INDEX IF NOT EXISTS idx_projects_sold_at      ON public.projects(sold_at);
CREATE INDEX IF NOT EXISTS idx_projects_active_at    ON public.projects(active_at);
CREATE INDEX IF NOT EXISTS idx_projects_completed_at ON public.projects(completed_at);

-- commission_payments — payroll history filters by date and approval state
CREATE INDEX IF NOT EXISTS idx_commission_payments_approved_at ON public.commission_payments(approved_at);
CREATE INDEX IF NOT EXISTS idx_commission_payments_approved_by ON public.commission_payments(approved_by);

-- notifications recipient — already added in section 8, no repeat needed


-- ── 14. RLS for new table ────────────────────────────────────
ALTER TABLE public.project_team_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_all_project_team_assignments"
  ON public.project_team_assignments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);


-- ── 15. Backfill: stage timestamps from existing data ────────
-- Best-effort only — exact timestamps not recoverable pre-migration.
-- Uses updated_at as the closest approximation.
DO $$
BEGIN
  -- clients: selling_at
  UPDATE public.clients
    SET selling_at = updated_at
  WHERE status IN ('selling', 'sold', 'active', 'completed')
    AND selling_at IS NULL;

  -- projects: sold → scheduled → active → completed
  UPDATE public.projects
    SET sold_at = updated_at
  WHERE status IN ('sold', 'scheduled', 'active', 'completed')
    AND sold_at IS NULL;

  UPDATE public.projects
    SET scheduled_at = updated_at
  WHERE status IN ('scheduled', 'active', 'completed')
    AND scheduled_at IS NULL;

  UPDATE public.projects
    SET active_at = updated_at
  WHERE status IN ('active', 'completed')
    AND active_at IS NULL;

  UPDATE public.projects
    SET completed_at = updated_at
  WHERE status = 'completed'
    AND completed_at IS NULL;

  RAISE NOTICE 'Stage timestamp backfill complete (best-effort from updated_at)';
END $$;
