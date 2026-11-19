-- Migration 138: monthly sales-tax filing reminders + per-change-order tax
--
-- WHY (Jonathan, Nov 18-20 2026):
--  1. "Yes" - change-order tax should count in the month the change order was APPROVED (Sales Tax Tracker), not in
--     the month the proposal was signed. change_orders.tax_amount stores the tax a change order added (negative for a
--     credit); it is written when the CO is merged. Older merged COs stay NULL and the tracker estimates them.
--  2. Remind Jonathan 1 week before the end of each month to file that month's sales tax: a red banner in the CRM he
--     can dismiss once filed, and a text message. This table holds one row per month ("YYYY-MM"): when the text was
--     sent and when it was dismissed as filed.
--
-- NOTE: no data in clients / projects / estimates is touched here (their audit triggers bump updated_at).

ALTER TABLE public.change_orders
  ADD COLUMN IF NOT EXISTS tax_amount numeric(12,2);

COMMENT ON COLUMN public.change_orders.tax_amount IS
  'Sales tax this change order added to the proposal (negative for a credit). Set when the CO is merged; NULL on COs merged before migration 138.';

CREATE TABLE IF NOT EXISTS public.sales_tax_filing_reminders (
  period        text PRIMARY KEY CHECK (period ~ '^[0-9]{4}-[0-9]{2}$'),  -- the month being filed, e.g. 2026-11
  sms_sent_at   timestamptz,
  dismissed_at  timestamptz,
  dismissed_by  uuid
);

COMMENT ON TABLE public.sales_tax_filing_reminders IS
  'One row per month for the sales-tax filing reminder. dismissed_at = marked as filed (hides the red CRM banner). sms_sent_at = text sent by the send-sales-tax-reminder Edge Function.';

ALTER TABLE public.sales_tax_filing_reminders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sales_tax_reminders_admin_all" ON public.sales_tax_filing_reminders;
CREATE POLICY "sales_tax_reminders_admin_all" ON public.sales_tax_filing_reminders
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'))
  WITH CHECK (EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin'));

-- ─── pg_cron: daily check, same pattern as onboarding-reminders (migration 112) ───────────────────────────
-- Runs every day at 14:00 UTC (8-9 AM Central). The Edge Function only sends on the day that is exactly 7 days before
-- the last day of the month (Central time), and only once per month.
DO $$
BEGIN
  PERFORM cron.unschedule('sales-tax-reminder')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'sales-tax-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'sales-tax-reminder',
  '0 14 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://yohhdvwifjgarnaxrbev.supabase.co/functions/v1/send-sales-tax-reminder',
      -- no Authorization header on purpose: the function is deployed without JWT verification and only ever sends on
      -- the reminder day, once per month, so it does not depend on the app.supabase_service_role_key setting
      headers := jsonb_build_object('Content-Type', 'application/json'),
      body    := '{}'::jsonb
    );
  $$
);
