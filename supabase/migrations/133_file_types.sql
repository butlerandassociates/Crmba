-- ─────────────────────────────────────────────────────────────────────────────
-- File types for the client "Notes & Files" card — managed from the admin portal.
--
-- Jonathan (Oct 20 2026): when someone uploads a file a pop-up should ask what kind of file it is, and
-- "I need to also have the ability within the admin portal to create what the file type names are."
--
-- client_files.file_type keeps storing the short `key` (contract, photo, certificate, ...). Code outside
-- this card depends on a few keys (the move-to-completed gates look for photo / certificate / subcontractor,
-- the foreman screens and the client portal group by key), so keys never change: admins can rename the
-- label, add new types, hide types and reorder them. Types marked is_system can be renamed and reordered
-- but never hidden, because something in the app relies on them.
-- Existing files keep their key, so nothing about existing data changes. Additive only.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.file_types (
  key         text        PRIMARY KEY,
  label       text        NOT NULL,
  sort_order  integer     NOT NULL DEFAULT 0,
  is_active   boolean     NOT NULL DEFAULT true,
  is_system   boolean     NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- Seed: exactly the types the dropdown had before, plus Payment (Jonathan's example). Re-runnable.
INSERT INTO public.file_types (key, label, sort_order, is_active, is_system) VALUES
  ('contract',      'Contract',                  10, true, true),
  ('proposal',      'Proposal',                  20, true, false),
  ('receipt',       'Receipt',                   30, true, false),
  ('payment',       'Payment',                   40, true, false),
  ('photo',         'Site Photo',                50, true, true),
  ('certificate',   'Certificate of Completion', 60, true, true),
  ('subcontractor', 'Subcontractor Agreement',   70, true, true),
  ('insurance',     'Insurance',                 80, true, false),
  ('other',         'Other',                    999, true, true)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.file_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "file_types_read" ON public.file_types;
CREATE POLICY "file_types_read" ON public.file_types FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "file_types_admin_write" ON public.file_types;
CREATE POLICY "file_types_admin_write" ON public.file_types FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
