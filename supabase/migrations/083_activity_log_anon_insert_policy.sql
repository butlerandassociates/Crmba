-- Migration 083: Allow anonymous users to insert activity log entries
-- Needed for public proposal page (accept/decline/view) which runs without auth.
-- performed_by will be null for anon inserts (same pattern as 042 for notifications).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'activity_log'
      AND policyname = 'anon_can_insert_activity_log'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY anon_can_insert_activity_log
        ON public.activity_log
        FOR INSERT
        TO anon
        WITH CHECK (performed_by IS NULL)
    $policy$;
  END IF;
END
$$;
