-- Migration 085: Mileage Tracker
-- Tables: mileage_settings, mileage_periods, mileage_submissions, mileage_trips
-- All audit columns included. Safe to re-run: uses IF NOT EXISTS / CREATE TABLE IF NOT EXISTS.

-- ─── 1. Settings (single row, admin-managed) ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.mileage_settings (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rate_per_mile             numeric(6,4)  NOT NULL DEFAULT 0.70,
  submission_deadline_day   int           NOT NULL DEFAULT 4,   -- 4 = Thursday (0=Sun)
  submission_deadline_hour  int           NOT NULL DEFAULT 14,  -- 14 = 2pm CST
  payment_day               int           NOT NULL DEFAULT 5,   -- 5 = Friday
  created_at                timestamptz   NOT NULL DEFAULT now(),
  updated_at                timestamptz   NOT NULL DEFAULT now(),
  updated_by                uuid          REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.mileage_settings                      IS 'Global mileage config — one row';
COMMENT ON COLUMN public.mileage_settings.rate_per_mile        IS 'IRS standard rate per mile (frozen on each submission at time of upload)';
COMMENT ON COLUMN public.mileage_settings.submission_deadline_day  IS '0=Sun 1=Mon 2=Tue 3=Wed 4=Thu 5=Fri 6=Sat';
COMMENT ON COLUMN public.mileage_settings.submission_deadline_hour IS '24h local hour (14 = 2pm CST)';

-- Seed default settings row
INSERT INTO public.mileage_settings (rate_per_mile, submission_deadline_day, submission_deadline_hour, payment_day)
VALUES (0.70, 4, 14, 5)
ON CONFLICT DO NOTHING;

-- ─── 2. Periods (weekly windows) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.mileage_periods (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start            date        NOT NULL,
  week_end              date        NOT NULL,
  submission_deadline   timestamptz NOT NULL,
  payment_date          date        NOT NULL,
  status                text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed')),
  is_active             boolean     NOT NULL DEFAULT true,
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at            timestamptz NOT NULL DEFAULT now(),
  updated_by            uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (week_start)
);

COMMENT ON TABLE  public.mileage_periods         IS 'Weekly mileage submission windows';
COMMENT ON COLUMN public.mileage_periods.status  IS 'open = accepting submissions; closed = period locked';
COMMENT ON COLUMN public.mileage_periods.is_active IS 'False = period soft-disabled by admin without deleting';

-- ─── 3. Submissions (one per employee per week) ────────────────────────────
CREATE TABLE IF NOT EXISTS public.mileage_submissions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id       uuid        NOT NULL REFERENCES public.mileage_periods(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status          text        NOT NULL DEFAULT 'draft'
                              CHECK (status IN ('draft', 'submitted', 'approved', 'denied')),
  submitted_at    timestamptz,
  reviewed_at     timestamptz,
  reviewed_by     uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  denial_reason   text,
  total_miles     numeric(10,2) NOT NULL DEFAULT 0,
  total_payout    numeric(10,2) NOT NULL DEFAULT 0,
  rate_per_mile   numeric(6,4)  NOT NULL DEFAULT 0.70,
  is_active       boolean     NOT NULL DEFAULT true,
  discarded_at    timestamptz,
  discarded_by    uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  UNIQUE (period_id, user_id)
);

COMMENT ON TABLE  public.mileage_submissions               IS 'One mileage submission per employee per week';
COMMENT ON COLUMN public.mileage_submissions.rate_per_mile IS 'Rate frozen at time of submission — IRS changes do not affect historical submissions';
COMMENT ON COLUMN public.mileage_submissions.denial_reason IS 'Required when admin sets status = denied';
COMMENT ON COLUMN public.mileage_submissions.is_active     IS 'False = admin voided submission without deleting it';

-- ─── 4. Trips (individual rows from Everlance CSV) ─────────────────────────
CREATE TABLE IF NOT EXISTS public.mileage_trips (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     uuid        NOT NULL REFERENCES public.mileage_submissions(id) ON DELETE CASCADE,
  trip_date         date        NOT NULL,
  start_address     text        NOT NULL,
  end_address       text        NOT NULL,
  miles             numeric(8,2) NOT NULL,
  project_id        uuid        REFERENCES public.projects(id) ON DELETE SET NULL,
  client_id         uuid        REFERENCES public.clients(id) ON DELETE SET NULL,
  is_duplicate      boolean     NOT NULL DEFAULT false,
  match_confidence  text        NOT NULL DEFAULT 'unmatched'
                                CHECK (match_confidence IN ('auto', 'manual', 'unmatched')),
  payout            numeric(8,2) NOT NULL DEFAULT 0,
  is_active         boolean     NOT NULL DEFAULT true,
  discarded_at      timestamptz,
  discarded_by      uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at        timestamptz NOT NULL DEFAULT now(),
  created_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid        REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE  public.mileage_trips                    IS 'Individual trip rows parsed from Everlance CSV';
COMMENT ON COLUMN public.mileage_trips.is_duplicate       IS 'True = same date+address combo already exists for this user';
COMMENT ON COLUMN public.mileage_trips.match_confidence   IS 'auto = system matched by address; manual = user picked project; unmatched = needs selection';
COMMENT ON COLUMN public.mileage_trips.payout             IS 'miles × rate_per_mile — computed and frozen at upload time';
COMMENT ON COLUMN public.mileage_trips.is_active          IS 'False = trip removed from submission without DB delete';

-- ─── 5. Indexes ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mileage_submissions_period   ON public.mileage_submissions(period_id);
CREATE INDEX IF NOT EXISTS idx_mileage_submissions_user     ON public.mileage_submissions(user_id);
CREATE INDEX IF NOT EXISTS idx_mileage_submissions_status   ON public.mileage_submissions(status);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_submission     ON public.mileage_trips(submission_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_project        ON public.mileage_trips(project_id);
CREATE INDEX IF NOT EXISTS idx_mileage_trips_date           ON public.mileage_trips(trip_date);

-- ─── 6. Updated_at auto-trigger (reuse pattern) ───────────────────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

DO $$ BEGIN
  CREATE TRIGGER trg_mileage_settings_updated_at
    BEFORE UPDATE ON public.mileage_settings
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mileage_periods_updated_at
    BEFORE UPDATE ON public.mileage_periods
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mileage_submissions_updated_at
    BEFORE UPDATE ON public.mileage_submissions
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_mileage_trips_updated_at
    BEFORE UPDATE ON public.mileage_trips
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── 7. RLS Policies ──────────────────────────────────────────────────────
ALTER TABLE public.mileage_settings    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.mileage_trips       ENABLE ROW LEVEL SECURITY;

-- Helper: is current user an admin? (checks profiles table, NOT jwt claim)
-- jwt 'role' is always 'authenticated' in this app — custom role lives in profiles.role

-- Settings: admin full access; all authenticated read
CREATE POLICY "mileage_settings_admin" ON public.mileage_settings FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "mileage_settings_read"  ON public.mileage_settings FOR SELECT
  USING (auth.role() = 'authenticated');

-- Periods: admin full access; all authenticated read
CREATE POLICY "mileage_periods_admin"  ON public.mileage_periods FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "mileage_periods_read"   ON public.mileage_periods FOR SELECT
  USING (auth.role() = 'authenticated');

-- Submissions: admin sees/edits all; employees manage only their own
CREATE POLICY "mileage_submissions_admin"   ON public.mileage_submissions FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "mileage_submissions_own"     ON public.mileage_submissions FOR SELECT
  USING (user_id = auth.uid());
CREATE POLICY "mileage_submissions_own_ins" ON public.mileage_submissions FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "mileage_submissions_own_upd" ON public.mileage_submissions FOR UPDATE
  USING (user_id = auth.uid() AND status = 'draft');

-- Trips: admin sees/edits all; employees manage only trips on their own draft submissions
CREATE POLICY "mileage_trips_admin"   ON public.mileage_trips FOR ALL
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "mileage_trips_own"     ON public.mileage_trips FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.mileage_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid()));
CREATE POLICY "mileage_trips_own_ins" ON public.mileage_trips FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.mileage_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status = 'draft'));
CREATE POLICY "mileage_trips_own_upd" ON public.mileage_trips FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.mileage_submissions s WHERE s.id = submission_id AND s.user_id = auth.uid() AND s.status = 'draft'));
