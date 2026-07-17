-- Migration 114: PDF file upload for onboarding documents
-- Adds file_url column to onboarding_documents + creates storage bucket.
-- Admins can upload an actual PDF file per document in the admin builder.
-- Safe to re-run.

-- ─── 1. file_url column ───────────────────────────────────────────────────────

ALTER TABLE public.onboarding_documents
  ADD COLUMN IF NOT EXISTS file_url text NULL;

COMMENT ON COLUMN public.onboarding_documents.file_url IS
  'Public Supabase storage URL for the uploaded PDF file, if any. Null = content-only document.';

-- ─── 2. Storage bucket ────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'onboarding-documents',
  'onboarding-documents',
  true,
  52428800,           -- 50 MB limit
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- ─── 3. Storage policies ──────────────────────────────────────────────────────

-- Authenticated users (admins) can upload
DO $$ BEGIN
  CREATE POLICY "ob_docs_insert" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'onboarding-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can replace existing uploads (upsert)
DO $$ BEGIN
  CREATE POLICY "ob_docs_update" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'onboarding-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Authenticated users can delete uploaded files
DO $$ BEGIN
  CREATE POLICY "ob_docs_delete" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'onboarding-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Public read (bucket is public — anyone can fetch the URL)
DO $$ BEGIN
  CREATE POLICY "ob_docs_select" ON storage.objects
    FOR SELECT USING (bucket_id = 'onboarding-documents');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
