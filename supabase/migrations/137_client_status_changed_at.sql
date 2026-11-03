-- "Days in stage" on the Pipeline board (Jonathan, Nov 3-4 2026: pipeline cards that show a brief overview of each
-- lead: lead source, proposal $, status, time in stage).
--
-- clients.updated_at moves on ANY edit (a phone number fix, a note), so it can't say how long a client has been in
-- its current stage. This adds one timestamp that moves only when clients.status actually changes.
--
-- Additive and safe to re-run. It deliberately does NOT update any existing client row: the clients UPDATE triggers
-- would bump updated_at / clear updated_by on every client. Existing clients keep a NULL here and the Pipeline page
-- falls back to their latest 'status_changed' activity-log entry, then created_at; from their next stage move on
-- the trigger below keeps this column exact. The page also ignores the column if this hasn't been run.

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS status_changed_at timestamptz;

CREATE OR REPLACE FUNCTION public.set_client_status_changed_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_clients_status_changed_at ON public.clients;
CREATE TRIGGER trg_clients_status_changed_at
  BEFORE UPDATE ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.set_client_status_changed_at();

COMMENT ON COLUMN public.clients.status_changed_at IS 'When clients.status last changed (set by trigger; NULL = not changed since this column was added). Drives "days in stage" on the Pipeline board.';
