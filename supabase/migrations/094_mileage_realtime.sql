-- Migration 094: Enable Supabase Realtime on the mileage tables
-- So the admin + employee mileage screens live-update on any INSERT/UPDATE/DELETE
-- (e.g. a denied/removed/paid trip reflects instantly without a page refresh).
-- Idempotent: skips tables already in the publication.

DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['mileage_submissions', 'mileage_trips', 'mileage_periods', 'mileage_settings'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- REPLICA IDENTITY FULL so DELETE events carry enough info for clients that filter.
ALTER TABLE public.mileage_submissions REPLICA IDENTITY FULL;
ALTER TABLE public.mileage_trips       REPLICA IDENTITY FULL;
ALTER TABLE public.mileage_periods     REPLICA IDENTITY FULL;
