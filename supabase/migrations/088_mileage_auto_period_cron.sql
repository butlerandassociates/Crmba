-- Migration 088: Auto-create the weekly mileage period + reminder notifications via pg_cron
-- So mileage is ALWAYS open for every PM/Sales Rep to submit each week,
-- with no dependency on an admin opening the page manually.
--
-- Confirmed by Jonathan Jun 2 2026:
--   - Pay week runs FRIDAY → THURSDAY
--   - Submission cutoff = Thursday 2pm CST (settings.submission_deadline_hour, default 14)
--   - Pay date = the Friday right after the cutoff (week_end + 1)
--   - Notify PMs/Sales Reps when a new week opens: YES
--   - Thursday-morning deadline reminder: YES
--
-- Mirrors the client-side ensureCurrentPeriod() in src/app/api/mileage.ts exactly.
-- NOTE: local→UTC uses +5 (CDT) to match the existing client code; revisit if a
-- proper America/Chicago tz conversion is wanted across DST.
--
-- ⚠️ Reminder day/time are PENDING Jonathan's exact-time reply. Defaults below:
--   - New-week-open reminder: Friday 08:00 CST  (period start)
--   - Deadline reminder:      Thursday 08:00 CST ("due today by 2pm")
-- Change the cron expressions / hour math in one place if he picks other times.
--
-- Safe to re-run.

-- ───────────────────────────────────────────────────────────────────────────
-- 1. Ensure the current Friday–Thursday period exists
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.ensure_current_mileage_period()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today          date := (now() AT TIME ZONE 'UTC')::date;
  v_dow            int;          -- 0=Sun .. 6=Sat (matches JS getDay); Friday = 5
  v_diff_to_friday int;
  v_week_start     date;
  v_week_end       date;
  v_deadline       timestamptz;
  v_payment        date;
  v_deadline_hour  int;
BEGIN
  -- Pull deadline hour from settings; fall back to 2pm
  SELECT submission_deadline_hour INTO v_deadline_hour
    FROM public.mileage_settings
    LIMIT 1;
  v_deadline_hour := COALESCE(v_deadline_hour, 14);  -- 2pm

  -- Most recent Friday on/before today (today if today is Friday)
  v_dow := EXTRACT(DOW FROM v_today)::int;           -- 0=Sun..6=Sat
  v_diff_to_friday := (v_dow - 5 + 7) % 7;
  v_week_start := v_today - v_diff_to_friday;
  v_week_end   := v_week_start + 6;                  -- Thursday

  -- Already exists? do nothing
  IF EXISTS (SELECT 1 FROM public.mileage_periods WHERE week_start = v_week_start) THEN
    RETURN;
  END IF;

  -- Deadline: the Thursday (week_end) at deadline_hour local → UTC (+5 for CDT)
  v_deadline := (v_week_end::timestamp + make_interval(hours => v_deadline_hour + 5))
                AT TIME ZONE 'UTC';

  -- Payment date: the Friday right after the cutoff
  v_payment := v_week_end + 1;

  INSERT INTO public.mileage_periods
    (week_start, week_end, submission_deadline, payment_date, status, is_active)
  VALUES
    (v_week_start, v_week_end, v_deadline, v_payment, 'open', true)
  ON CONFLICT (week_start) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION public.ensure_current_mileage_period() IS
  'Creates the current Friday–Thursday mileage period if it does not exist. Run weekly via pg_cron so mileage is always open for employees.';

-- ───────────────────────────────────────────────────────────────────────────
-- 2. Notify all PMs/Sales Reps that a new mileage week has opened
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mileage_notify_week_open()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Make sure the period exists before reminding anyone
  PERFORM public.ensure_current_mileage_period();

  INSERT INTO public.notifications (type, title, message, link, recipient_id, is_read)
  SELECT
    'mileage_week_open',
    'New mileage week is open',
    'Log this week''s trips and submit before Thursday 2pm CST.',
    '/mileage',
    p.id,
    false
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.role IN ('project_manager', 'sales_rep');
END;
$$;

COMMENT ON FUNCTION public.mileage_notify_week_open() IS
  'Notifies every active PM/Sales Rep that the new Friday–Thursday mileage week is open.';

-- ───────────────────────────────────────────────────────────────────────────
-- 3. Deadline reminder — only those who have not yet submitted this period
-- ───────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.mileage_notify_deadline()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today    date := (now() AT TIME ZONE 'UTC')::date;
  v_period   public.mileage_periods%ROWTYPE;
BEGIN
  -- Current open period containing today
  SELECT * INTO v_period
    FROM public.mileage_periods
    WHERE is_active = true
      AND week_start <= v_today
      AND week_end   >= v_today
    ORDER BY week_start DESC
    LIMIT 1;

  IF v_period.id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.notifications (type, title, message, link, recipient_id, is_read)
  SELECT
    'mileage_deadline',
    'Mileage due today by 2pm CST',
    'Submit your trips for this week before the 2pm cutoff to be paid Friday.',
    '/mileage',
    p.id,
    false
  FROM public.profiles p
  WHERE p.is_active = true
    AND p.role IN ('project_manager', 'sales_rep')
    -- skip anyone who already submitted/approved this period
    AND NOT EXISTS (
      SELECT 1 FROM public.mileage_submissions s
      WHERE s.period_id = v_period.id
        AND s.user_id   = p.id
        AND s.is_active  = true
        AND s.status IN ('submitted', 'approved')
    );
END;
$$;

COMMENT ON FUNCTION public.mileage_notify_deadline() IS
  'Thursday-morning reminder to PMs/Sales Reps who have not yet submitted the current mileage period.';

-- Create this week's period right now so it is immediately available
SELECT public.ensure_current_mileage_period();

-- ───────────────────────────────────────────────────────────────────────────
-- 4. Schedules (pg_cron, UTC). Remove old ones first so this is re-runnable.
-- ───────────────────────────────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.unschedule('mileage-weekly-period')       WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mileage-weekly-period');
  PERFORM cron.unschedule('mileage-daily-period-safety') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mileage-daily-period-safety');
  PERFORM cron.unschedule('mileage-week-open-reminder')  WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mileage-week-open-reminder');
  PERFORM cron.unschedule('mileage-deadline-reminder')   WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'mileage-deadline-reminder');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- Period creation: every Friday 00:05 UTC (period start), + daily safety net
SELECT cron.schedule('mileage-weekly-period',       '5 0 * * 5',  $$ SELECT public.ensure_current_mileage_period(); $$);
SELECT cron.schedule('mileage-daily-period-safety', '10 0 * * *', $$ SELECT public.ensure_current_mileage_period(); $$);

-- New-week-open reminder: Friday 08:00 CST = 13:00 UTC  (PENDING Jonathan's exact time)
SELECT cron.schedule('mileage-week-open-reminder',  '0 13 * * 5', $$ SELECT public.mileage_notify_week_open(); $$);

-- Deadline reminder: Thursday 08:00 CST = 13:00 UTC  (PENDING Jonathan's exact time)
SELECT cron.schedule('mileage-deadline-reminder',   '0 13 * * 4', $$ SELECT public.mileage_notify_deadline(); $$);
