-- Migration 119: Add missing storage policies for client-files bucket
-- Buckets already exist (created manually). ON CONFLICT DO NOTHING is safe.

INSERT INTO storage.buckets (id, name, public)
VALUES ('phase-task-photos', 'phase-task-photos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('client-files', 'client-files', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Authenticated users can update client files'
  ) THEN
    CREATE POLICY "Authenticated users can update client files"
    ON storage.objects FOR UPDATE TO authenticated
    USING (bucket_id = 'client-files');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public can view client files'
  ) THEN
    CREATE POLICY "Public can view client files"
    ON storage.objects FOR SELECT TO public
    USING (bucket_id = 'client-files');
  END IF;
END$$;
