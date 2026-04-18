-- Allow anonymous users to insert notifications (needed for public proposal accept/decline)
-- created_by will be null for anon inserts
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'notifications'
      AND policyname = 'anon_can_insert_notifications'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY anon_can_insert_notifications
        ON public.notifications
        FOR INSERT
        TO anon
        WITH CHECK (created_by IS NULL)
    $policy$;
  END IF;
END
$$;
