-- ─────────────────────────────────────────────────────────────────────────────
-- Email open tracking for emails sent from the CRM.
--
-- Jonathan (Oct 19 2026): "is there a way to put an indicator next to the emails we send out via CRM
-- that shows us if the client has opened the email and time stamp it?" (he accepted that opens are an
-- indicator, not proof: Apple Mail / Gmail can pre-load the tracking image, image-blocking hides real opens).
--
-- How it works
--   * Every tracked send gets a tracking_id (a uuid made by the CRM). The send-email / send-portal-
--     notification edge functions pass it to SendGrid as a custom arg, turn on open tracking, and
--     create the email_tracking row.
--   * SendGrid's Event Webhook ("Opened" events) calls handle-sendgrid-bounce, which calls
--     record_email_open() for each open. sg_event_id makes it safe when SendGrid retries a batch.
--   * The CRM Activity Log looks up email_tracking by activity_log.tracking_id and shows
--     "Opened · <time> · N×" or "Not opened yet" next to the email entry.
--
-- Additive only: one nullable column on activity_log, two new tables, one function.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.activity_log ADD COLUMN IF NOT EXISTS tracking_id uuid;
CREATE INDEX IF NOT EXISTS idx_activity_log_tracking_id ON public.activity_log(tracking_id) WHERE tracking_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.email_tracking (
  id              uuid        PRIMARY KEY,                       -- = the tracking_id sent to SendGrid
  client_id       uuid        REFERENCES public.clients(id) ON DELETE CASCADE,
  to_email        text,
  subject         text,
  sent_at         timestamptz NOT NULL DEFAULT now(),
  first_opened_at timestamptz,
  last_opened_at  timestamptz,
  open_count      integer     NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_email_tracking_client_id ON public.email_tracking(client_id);

CREATE TABLE IF NOT EXISTS public.email_open_events (
  sg_event_id text        PRIMARY KEY,                           -- SendGrid's unique id for the event
  tracking_id uuid        NOT NULL REFERENCES public.email_tracking(id) ON DELETE CASCADE,
  opened_at   timestamptz NOT NULL
);

-- Staff can read the results; writes only come from the edge functions (service role bypasses RLS).
ALTER TABLE public.email_tracking     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_open_events  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "email_tracking_read_authenticated" ON public.email_tracking;
CREATE POLICY "email_tracking_read_authenticated"
  ON public.email_tracking FOR SELECT TO authenticated USING (true);

-- Records one open. Returns true when it was new (false for a duplicate / retried event).
CREATE OR REPLACE FUNCTION public.record_email_open(
  p_event_id    text,
  p_tracking_id uuid,
  p_opened_at   timestamptz
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_rows integer;
BEGIN
  -- send-email creates the row before sending; this only covers an event arriving for an unknown id
  INSERT INTO public.email_tracking (id) VALUES (p_tracking_id) ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.email_open_events (sg_event_id, tracking_id, opened_at)
  VALUES (p_event_id, p_tracking_id, p_opened_at)
  ON CONFLICT (sg_event_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN
    RETURN false;
  END IF;

  UPDATE public.email_tracking
     SET open_count      = open_count + 1,
         first_opened_at = LEAST(COALESCE(first_opened_at, p_opened_at), p_opened_at),
         last_opened_at  = GREATEST(COALESCE(last_opened_at, p_opened_at), p_opened_at)
   WHERE id = p_tracking_id;
  RETURN true;
END;
$$;

-- SECURITY DEFINER functions are executable by everyone by default; only the edge function (service role) may call this.
REVOKE ALL ON FUNCTION public.record_email_open(text, uuid, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_email_open(text, uuid, timestamptz) TO service_role;

-- Live updates for the open indicator in the Activity Log (no-op if realtime isn't set up on this project).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.email_tracking;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
