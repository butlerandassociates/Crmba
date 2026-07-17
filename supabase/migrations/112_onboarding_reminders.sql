-- Migration 112: Onboarding reminder logs + pg_cron schedule
-- Tracks when automated onboarding reminder emails were sent per user/program.
-- Reminders fire every 3 days for any employee who hasn't reached 100% completion.
-- CC: jonathan@butlerconstruction.co + info@butlerconstruction.co (Thomas) on every email.
-- Safe to re-run.

-- ─── Reminder log table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_reminder_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  program_id  UUID        NOT NULL REFERENCES public.onboarding_programs(id) ON DELETE CASCADE,
  email_to    TEXT,
  overall_pct INTEGER,
  sent_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS onboarding_reminder_logs_user_program_sent
  ON public.onboarding_reminder_logs(user_id, program_id, sent_at DESC);

-- RLS: admin read-only, service role writes (edge function uses service role key)
ALTER TABLE public.onboarding_reminder_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_read_reminder_logs"
  ON public.onboarding_reminder_logs
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

COMMENT ON TABLE public.onboarding_reminder_logs IS
  'Tracks automated onboarding reminder emails — one row per send. Used to enforce the 3-day gap between reminders.';

-- ─── pg_cron schedule ─────────────────────────────────────────────────────────
-- Fires every 3 days at 8:00 AM CST (13:00 UTC).
-- Calls the send-onboarding-reminders Edge Function via net.http_post.
-- Requires: pg_cron + pg_net extensions (both enabled on this project).

DO $$
BEGIN
  PERFORM cron.unschedule('onboarding-reminders')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'onboarding-reminders');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'onboarding-reminders',
  '0 13 */3 * *',
  $$
    SELECT net.http_post(
      url     := 'https://yohhdvwifjgarnaxrbev.supabase.co/functions/v1/send-onboarding-reminders',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.supabase_service_role_key', true)
      ),
      body    := '{}'::jsonb
    );
  $$
);

COMMENT ON TABLE public.onboarding_reminder_logs IS
  'Reminder log — cron job ''onboarding-reminders'' fires every 3 days at 8am CST via pg_cron + net.http_post to the send-onboarding-reminders Edge Function.';
