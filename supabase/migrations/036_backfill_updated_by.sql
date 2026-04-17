-- ============================================================
-- Migration 036: Backfill updated_by → Jonathan
-- For all rows that already have updated_at set (meaning they
-- were updated before the audit trail was in place), attribute
-- the update to Jonathan as the founding admin.
-- ============================================================
DO $$
DECLARE jonathan_id uuid;
BEGIN
  SELECT id INTO jonathan_id
  FROM auth.users
  WHERE email = 'jonathan@butlerconstruction.co'
  LIMIT 1;

  IF jonathan_id IS NULL THEN
    RAISE NOTICE 'Jonathan account not found — skipping backfill';
    RETURN;
  END IF;

  -- Core business tables
  UPDATE public.clients                        SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.projects                       SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.estimates                      SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.estimate_line_items            SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.contracts                      SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.appointments                   SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.change_orders                  SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.change_order_items             SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.purchase_orders                SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.purchase_order_items           SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.field_installation_orders      SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.field_installation_order_items SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.project_payments               SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.project_receipts               SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.commission_payments            SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.fio_crew_payments              SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.invoices                       SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.invoice_line_items             SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.progress_payments              SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.deposits                       SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.payments                       SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.payment_schedules              SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;

  -- Admin / config tables
  UPDATE public.products_services              SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.email_templates                SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.docusign_templates             SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.pipeline_stages                SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.lead_sources                   SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.service_categories             SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.roles                          SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.permissions                    SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.role_permissions               SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.revenue_goals                  SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.vendors                        SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.crew_profiles                  SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.crew_labor_assignments         SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.project_assignments            SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.project_line_items             SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.project_crew                   SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.scope_of_work                  SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.units                          SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;

  -- Communication / system tables
  UPDATE public.client_notes                   SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.client_files                   SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.email_logs                     SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.notifications                  SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;
  UPDATE public.appointment_types              SET updated_by = jonathan_id WHERE updated_by IS NULL AND updated_at IS NOT NULL;

  RAISE NOTICE 'Backfill complete — updated_by set to Jonathan (%) for all pre-existing rows', jonathan_id;
END $$;
