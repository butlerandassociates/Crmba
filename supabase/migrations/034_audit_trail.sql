-- ============================================================
-- Migration 034: Full Audit Trail
-- Adds created_by, updated_by, updated_at, discarded_by
-- to all business tables. Trigger-based — no app code changes.
-- ============================================================

-- ── STEP 1: Add missing updated_at columns ──────────────────
ALTER TABLE public.appointment_types        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.change_order_items       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.client_files             ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.client_notes             ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.commission_payments      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.crew_labor_assignments   ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.crew_profiles            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.deposits                 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.docusign_templates       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.email_logs               ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.estimate_line_items      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.field_installation_order_items ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.fio_crew_payments        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.invoice_line_items       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.lead_sources             ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.notifications            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payment_schedules        ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.payments                 ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.permissions              ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.pipeline_stages          ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_assignments      ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_crew             ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_line_items       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_payments         ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.project_receipts         ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.purchase_order_items     ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.revenue_goals            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.role_permissions         ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.roles                    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.scope_of_work            ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.service_categories       ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.units                    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.user_dismissed_alerts    ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.vendors                  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();


-- ── STEP 2: Add missing created_by columns ──────────────────
ALTER TABLE public.appointment_types        ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.change_order_items       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.change_orders            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_files             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_notes             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.commission_payments      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.company_settings         ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crew_labor_assignments   ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crew_profiles            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.deposits                 ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.docusign_templates       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.email_logs               ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.email_templates          ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.estimate_line_items      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.field_installation_order_items ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.fio_crew_payments        ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_line_items       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_sources             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payment_schedules        ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments                 ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.permissions              ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pipeline_stages          ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.products_services        ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles                 ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.progress_payments        ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_assignments      ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_crew             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_line_items       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_payments         ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_order_items     ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.revenue_goals            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_permissions         ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.roles                    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.scope_of_work            ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.service_categories       ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.units                    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.user_dismissed_alerts    ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_bills             ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors                  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects                 ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── STEP 3: Add updated_by to ALL tables ────────────────────
ALTER TABLE public.appointment_types        ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.appointments             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.change_order_items       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.change_orders            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_files             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.client_notes             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.clients                  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.commission_payments      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.company_settings         ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.contracts                ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crew_labor_assignments   ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.crew_profiles            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.deposits                 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.docusign_templates       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.email_logs               ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.email_templates          ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.estimate_line_items      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.estimate_templates       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.estimates                ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.field_installation_order_items ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.field_installation_orders ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.fio_crew_payments        ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_line_items       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.invoices                 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.lead_sources             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.notifications            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payment_schedules        ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.payments                 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.permissions              ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.pipeline_stages          ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.products_services        ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.profiles                 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.progress_payments        ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_assignments      ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_crew             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_line_items       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_payments         ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.project_receipts         ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.projects                 ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_order_items     ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.purchase_orders          ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.revenue_goals            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.role_permissions         ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.roles                    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.scope_of_work            ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.service_categories       ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.units                    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.user_dismissed_alerts    ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendor_bills             ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
ALTER TABLE public.vendors                  ADD COLUMN IF NOT EXISTS updated_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── STEP 4: discarded_by on clients ─────────────────────────
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS discarded_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;


-- ── STEP 5: Trigger functions ────────────────────────────────

-- Sets created_by = auth.uid() on INSERT (only if null, never overwrites)
CREATE OR REPLACE FUNCTION public.fn_audit_created_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.created_by IS NULL THEN
    NEW.created_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Sets updated_by = auth.uid() + updated_at = now() on every UPDATE
CREATE OR REPLACE FUNCTION public.fn_audit_updated_by()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  NEW.updated_by := auth.uid();
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;


-- ── STEP 6: Apply INSERT triggers (created_by) ───────────────
DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'appointment_types','appointments','change_order_items','change_orders',
    'client_files','client_notes','clients','commission_payments',
    'company_settings','contracts','crew_labor_assignments','crew_profiles',
    'deposits','docusign_templates','email_logs','email_templates',
    'estimate_line_items','estimate_templates','estimates',
    'field_installation_order_items','field_installation_orders',
    'fio_crew_payments','invoice_line_items','invoices','lead_sources',
    'notifications','payment_schedules','payments','permissions',
    'pipeline_stages','products_services','profiles','progress_payments',
    'project_assignments','project_crew','project_line_items',
    'project_payments','project_receipts','projects',
    'purchase_order_items','purchase_orders','revenue_goals',
    'role_permissions','roles','scope_of_work','service_categories',
    'units','user_dismissed_alerts','vendor_bills','vendors'
  ]) LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%I_created_by
       BEFORE INSERT ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by()',
      t, t
    );
  END LOOP;
END $$;


-- ── STEP 7: Apply UPDATE triggers (updated_by + updated_at) ──
-- Drop old single-purpose updated_at triggers first, then create combined ones
DROP TRIGGER IF EXISTS trg_appointments_updated_at     ON public.appointments;
DROP TRIGGER IF EXISTS trg_clients_updated_at          ON public.clients;
DROP TRIGGER IF EXISTS trg_company_settings_updated_at ON public.company_settings;
DROP TRIGGER IF EXISTS trg_contracts_updated_at        ON public.contracts;
DROP TRIGGER IF EXISTS trg_email_templates_updated_at  ON public.email_templates;
DROP TRIGGER IF EXISTS trg_estimates_updated_at        ON public.estimates;
DROP TRIGGER IF EXISTS trg_invoices_updated_at         ON public.invoices;
DROP TRIGGER IF EXISTS trg_products_services_updated_at ON public.products_services;
DROP TRIGGER IF EXISTS trg_profiles_updated_at         ON public.profiles;
DROP TRIGGER IF EXISTS trg_progress_payments_updated_at ON public.progress_payments;
DROP TRIGGER IF EXISTS trg_projects_updated_at         ON public.projects;
DROP TRIGGER IF EXISTS trg_vendor_bills_updated_at     ON public.vendor_bills;

DO $$ DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'appointment_types','appointments','change_order_items','change_orders',
    'client_files','client_notes','clients','commission_payments',
    'company_settings','contracts','crew_labor_assignments','crew_profiles',
    'deposits','docusign_templates','email_logs','email_templates',
    'estimate_line_items','estimate_templates','estimates',
    'field_installation_order_items','field_installation_orders',
    'fio_crew_payments','invoice_line_items','invoices','lead_sources',
    'notifications','payment_schedules','payments','permissions',
    'pipeline_stages','products_services','profiles','progress_payments',
    'project_assignments','project_crew','project_line_items',
    'project_payments','project_receipts','projects',
    'purchase_order_items','purchase_orders','revenue_goals',
    'role_permissions','roles','scope_of_work','service_categories',
    'units','user_dismissed_alerts','vendor_bills','vendors'
  ]) LOOP
    EXECUTE format(
      'CREATE OR REPLACE TRIGGER trg_%I_audit_updated
       BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by()',
      t, t
    );
  END LOOP;
END $$;


-- ── STEP 8: Indexes for fast "who did what" queries ──────────
CREATE INDEX IF NOT EXISTS idx_clients_created_by       ON public.clients(created_by);
CREATE INDEX IF NOT EXISTS idx_clients_updated_by       ON public.clients(updated_by);
CREATE INDEX IF NOT EXISTS idx_clients_discarded_by     ON public.clients(discarded_by);
CREATE INDEX IF NOT EXISTS idx_projects_created_by      ON public.projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_updated_by      ON public.projects(updated_by);
CREATE INDEX IF NOT EXISTS idx_estimates_created_by     ON public.estimates(created_by);
CREATE INDEX IF NOT EXISTS idx_estimates_updated_by     ON public.estimates(updated_by);
CREATE INDEX IF NOT EXISTS idx_contracts_created_by     ON public.contracts(created_by);
CREATE INDEX IF NOT EXISTS idx_contracts_updated_by     ON public.contracts(updated_by);
CREATE INDEX IF NOT EXISTS idx_appointments_created_by  ON public.appointments(created_by);
CREATE INDEX IF NOT EXISTS idx_appointments_updated_by  ON public.appointments(updated_by);
CREATE INDEX IF NOT EXISTS idx_change_orders_created_by ON public.change_orders(created_by);
CREATE INDEX IF NOT EXISTS idx_purchase_orders_created_by ON public.purchase_orders(created_by);


-- ── STEP 9: Backfill existing rows — set created_by to Jonathan's account ──
-- All rows created before this migration have NULL created_by.
-- We attribute them to Jonathan (jonathan@butlerconstruction.co) as the founding admin.
DO $$
DECLARE jonathan_id uuid;
BEGIN
  SELECT p.id INTO jonathan_id
  FROM public.profiles p
  JOIN auth.users u ON u.id = p.id
  WHERE u.email = 'jonathan@butlerconstruction.co'
  LIMIT 1;

  IF jonathan_id IS NULL THEN
    RAISE NOTICE 'Jonathan account not found — skipping backfill';
    RETURN;
  END IF;

  -- Core business tables
  UPDATE public.clients               SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.projects              SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.estimates             SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.estimate_line_items   SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.contracts             SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.appointments          SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.change_orders         SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.change_order_items    SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.purchase_orders       SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.purchase_order_items  SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.field_installation_orders      SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.field_installation_order_items SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.project_payments      SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.project_receipts      SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.commission_payments   SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.fio_crew_payments     SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.invoices              SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.invoice_line_items    SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.progress_payments     SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.deposits              SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.payments              SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.payment_schedules     SET created_by = jonathan_id WHERE created_by IS NULL;

  -- Admin / config tables
  UPDATE public.products_services     SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.email_templates       SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.docusign_templates    SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.pipeline_stages       SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.lead_sources          SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.service_categories    SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.roles                 SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.permissions           SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.role_permissions      SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.revenue_goals         SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.vendors               SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.crew_profiles         SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.crew_labor_assignments SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.project_assignments   SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.project_line_items    SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.project_crew          SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.scope_of_work         SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.units                 SET created_by = jonathan_id WHERE created_by IS NULL;

  -- Communication / system tables
  UPDATE public.client_notes          SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.client_files          SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.email_logs            SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.notifications         SET created_by = jonathan_id WHERE created_by IS NULL;
  UPDATE public.appointment_types     SET created_by = jonathan_id WHERE created_by IS NULL;

  RAISE NOTICE 'Backfill complete — all existing rows attributed to Jonathan (%)' , jonathan_id;
END $$;
