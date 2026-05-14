-- ============================================================
-- Migration 067: Client Portal — Full Schema
-- Butler & Associates CRM — May 12 2026
--
-- All portal tables in one migration:
--   1.  client_portal_tokens      — tokenized access (no passwords)
--   2.  project_phases            — client-visible project timeline
--   3.  portal_updates            — PM field updates with photo galleries
--   4.  portal_update_photos      — photos per update (admin approval queue)
--   5.  ALTER projects            — progress_pct, target_date, project_type,
--                                   portal_enabled, days_total
--   6.  ALTER project_payments    — breakdown jsonb, confirmation_code
--   7.  Indexes
--   8.  RLS policies
--   9.  Audit triggers
--  10.  Helper functions (token generation, access logging, phase init)
-- ============================================================


-- ── 1. CLIENT PORTAL TOKENS ──────────────────────────────────
-- One token per client. Unique encrypted URL — no passwords.
-- Token is active until project is marked complete OR manually revoked.
-- IP log is a JSONB array: [{ip, ua, ts}, ...] appended on each access.

CREATE TABLE IF NOT EXISTS public.client_portal_tokens (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  client_id        uuid        NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,

  -- The token — 32 random bytes hex-encoded = 64 char URL-safe string
  token            text        NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),

  -- Lifecycle
  is_active        boolean     NOT NULL DEFAULT true,
  access_count     integer     NOT NULL DEFAULT 0,
  last_accessed_at timestamptz NULL,

  -- IP logging (append-only JSONB array)
  ip_log           jsonb       NOT NULL DEFAULT '[]'::jsonb,

  -- Revocation (when admin manually invalidates a token)
  revoked_at       timestamptz NULL,
  revoked_by       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,

  -- Standard audit
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  created_by       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by       uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_tokens_token      ON public.client_portal_tokens(token);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_client_id  ON public.client_portal_tokens(client_id);
CREATE INDEX IF NOT EXISTS idx_portal_tokens_is_active  ON public.client_portal_tokens(is_active);


-- ── 2. PROJECT PHASES ────────────────────────────────────────
-- Client-visible project timeline (Pre-Walk → Demo → Grading → etc.)
-- Separate from FIO crew steps — these are the high-level phases shown in portal.
-- Admin creates/updates phases; client sees read-only timeline.

CREATE TABLE IF NOT EXISTS public.project_phases (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  project_id     uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,

  -- Phase details
  label          text        NOT NULL,       -- e.g. "Pre-Walk & Site Prep"
  order_index    integer     NOT NULL DEFAULT 0,

  -- Status + progress
  status         text        NOT NULL DEFAULT 'upcoming'
                             CHECK (status IN ('upcoming', 'in-progress', 'complete')),
  progress_pct   numeric(5,2) NOT NULL DEFAULT 0
                             CHECK (progress_pct BETWEEN 0 AND 100),

  -- Dates shown to client
  expected_date  date        NULL,           -- shown when upcoming/in-progress
  completed_date date        NULL,           -- shown when complete

  -- Soft delete (admin can deactivate a phase without removing history)
  is_active      boolean     NOT NULL DEFAULT true,

  -- Standard audit
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  created_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by     uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_id   ON public.project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_order_index  ON public.project_phases(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_project_phases_status       ON public.project_phases(status);
CREATE INDEX IF NOT EXISTS idx_project_phases_is_active    ON public.project_phases(is_active);


-- ── 3. PORTAL UPDATES ────────────────────────────────────────
-- PM posts field updates visible to the client.
-- Each update has a title, body, completed items, upcoming items, and photos.
-- Admin controls visibility (is_visible = false hides from client).

CREATE TABLE IF NOT EXISTS public.portal_updates (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  project_id      uuid        NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  posted_by       uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Content
  title           text        NOT NULL,
  body            text        NOT NULL,

  -- Checklist arrays (shown in "Completed" + "Coming Up" sections)
  completed_items text[]      NOT NULL DEFAULT '{}',
  upcoming_items  text[]      NOT NULL DEFAULT '{}',

  -- Visibility: admin can hide from client without deleting
  is_visible      boolean     NOT NULL DEFAULT true,

  -- Soft delete
  is_active       boolean     NOT NULL DEFAULT true,

  -- Standard audit
  posted_at       timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  created_by      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by      uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_portal_updates_project_id  ON public.portal_updates(project_id);
CREATE INDEX IF NOT EXISTS idx_portal_updates_posted_by   ON public.portal_updates(posted_by);
CREATE INDEX IF NOT EXISTS idx_portal_updates_posted_at   ON public.portal_updates(posted_at DESC);
CREATE INDEX IF NOT EXISTS idx_portal_updates_is_visible  ON public.portal_updates(is_visible);
CREATE INDEX IF NOT EXISTS idx_portal_updates_is_active   ON public.portal_updates(is_active);


-- ── 4. PORTAL UPDATE PHOTOS ──────────────────────────────────
-- Photos attached to a portal update.
-- Approval workflow: PM uploads → admin approves → client sees.
-- marketing_flagged photos NEVER shown to client (internal use only).

CREATE TABLE IF NOT EXISTS public.portal_update_photos (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Ownership
  update_id           uuid        NOT NULL REFERENCES public.portal_updates(id) ON DELETE CASCADE,
  uploaded_by         uuid        NOT NULL REFERENCES public.profiles(id) ON DELETE RESTRICT,

  -- Storage
  storage_path        text        NOT NULL,  -- Supabase storage path
  public_url          text        NULL,      -- cached public URL (set after upload)
  label               text        NULL,      -- caption shown under photo

  -- Ordering
  order_index         integer     NOT NULL DEFAULT 0,

  -- Approval workflow
  approval_status     text        NOT NULL DEFAULT 'pending'
                                  CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  approved_by         uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  approved_at         timestamptz NULL,
  rejection_reason    text        NULL,

  -- Marketing flag — never shown to client if true
  is_marketing_flagged boolean    NOT NULL DEFAULT false,

  -- Soft delete
  is_active           boolean     NOT NULL DEFAULT true,

  -- Standard audit
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  created_by          uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_by          uuid        NULL REFERENCES public.profiles(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_update_photos_update_id        ON public.portal_update_photos(update_id);
CREATE INDEX IF NOT EXISTS idx_update_photos_approval_status  ON public.portal_update_photos(approval_status);
CREATE INDEX IF NOT EXISTS idx_update_photos_is_active        ON public.portal_update_photos(is_active);
CREATE INDEX IF NOT EXISTS idx_update_photos_marketing_flag   ON public.portal_update_photos(is_marketing_flagged);
CREATE INDEX IF NOT EXISTS idx_update_photos_order            ON public.portal_update_photos(update_id, order_index);


-- ── 5. ALTER PROJECTS — portal-relevant columns ──────────────
-- From mock data: progressPct, targetDate, project type label,
-- portal on/off toggle, days_total for "Day X of Y" display.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS progress_pct    numeric(5,2)  NOT NULL DEFAULT 0
                                           CHECK (progress_pct BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS target_date     date          NULL,   -- target completion date
  ADD COLUMN IF NOT EXISTS project_type    text          NULL,   -- e.g. "Paver Patio + Outdoor Kitchen"
  ADD COLUMN IF NOT EXISTS days_total      integer       NULL,   -- total planned project days
  ADD COLUMN IF NOT EXISTS portal_enabled  boolean       NOT NULL DEFAULT false;
  -- portal_enabled = true generates/activates the token for this project's client

CREATE INDEX IF NOT EXISTS idx_projects_portal_enabled ON public.projects(portal_enabled);
CREATE INDEX IF NOT EXISTS idx_projects_target_date    ON public.projects(target_date);


-- ── 6. ALTER PROJECT_PAYMENTS — portal-relevant columns ──────
-- From mock data: breakdown (line items inside each draw),
-- confirmation_code (Stripe/ACH confirmation shown after payment).

ALTER TABLE public.project_payments
  ADD COLUMN IF NOT EXISTS breakdown         jsonb  NULL,
  -- breakdown = [{"label": "Permits & mobilization", "amount": 4200}, ...]

  ADD COLUMN IF NOT EXISTS confirmation_code text   NULL;
  -- e.g. "ch_3O7Kp2Bqx9" — Stripe charge ID or ACH reference

CREATE INDEX IF NOT EXISTS idx_project_payments_is_paid ON public.project_payments(is_paid);


-- ── 7. RLS POLICIES ──────────────────────────────────────────
-- Admin CRM: full authenticated access to manage portal data.
-- Portal (client-facing): goes through edge functions using service role key.
-- Therefore anon gets NO direct table access — edge functions are the auth layer.

ALTER TABLE public.client_portal_tokens    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_phases          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_updates          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_update_photos    ENABLE ROW LEVEL SECURITY;

-- client_portal_tokens: admin only
CREATE POLICY "portal_tokens_auth_all"
  ON public.client_portal_tokens
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- project_phases: admin full access
CREATE POLICY "project_phases_auth_all"
  ON public.project_phases
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- portal_updates: admin full access
CREATE POLICY "portal_updates_auth_all"
  ON public.portal_updates
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- portal_update_photos: admin full access
CREATE POLICY "portal_update_photos_auth_all"
  ON public.portal_update_photos
  FOR ALL TO authenticated
  USING (true) WITH CHECK (true);


-- ── 8. AUDIT TRIGGERS ────────────────────────────────────────
-- Uses existing fn_audit_created_by() and fn_audit_updated_by()
-- defined in migration 034.

CREATE OR REPLACE TRIGGER trg_portal_tokens_created_by
  BEFORE INSERT ON public.client_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by();

CREATE OR REPLACE TRIGGER trg_portal_tokens_updated_by
  BEFORE UPDATE ON public.client_portal_tokens
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by();

-- ──

CREATE OR REPLACE TRIGGER trg_project_phases_created_by
  BEFORE INSERT ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by();

CREATE OR REPLACE TRIGGER trg_project_phases_updated_by
  BEFORE UPDATE ON public.project_phases
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by();

-- ──

CREATE OR REPLACE TRIGGER trg_portal_updates_created_by
  BEFORE INSERT ON public.portal_updates
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by();

CREATE OR REPLACE TRIGGER trg_portal_updates_updated_by
  BEFORE UPDATE ON public.portal_updates
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by();

-- ──

CREATE OR REPLACE TRIGGER trg_portal_update_photos_created_by
  BEFORE INSERT ON public.portal_update_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_created_by();

CREATE OR REPLACE TRIGGER trg_portal_update_photos_updated_by
  BEFORE UPDATE ON public.portal_update_photos
  FOR EACH ROW EXECUTE FUNCTION public.fn_audit_updated_by();


-- ── 9. HELPER FUNCTIONS ──────────────────────────────────────

-- generate_portal_token(client_id, created_by)
-- Revokes any existing active token for this client, creates a fresh one.
-- Call this from admin CRM when enabling portal for a client.
CREATE OR REPLACE FUNCTION public.generate_portal_token(
  p_client_id  uuid,
  p_created_by uuid
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_token text;
BEGIN
  -- Revoke existing active tokens
  UPDATE public.client_portal_tokens
  SET
    is_active  = false,
    revoked_at = now(),
    revoked_by = p_created_by,
    updated_at = now(),
    updated_by = p_created_by
  WHERE client_id = p_client_id AND is_active = true;

  -- Generate new 64-char hex token
  v_token := encode(gen_random_bytes(32), 'hex');

  INSERT INTO public.client_portal_tokens (client_id, token, created_by, updated_by)
  VALUES (p_client_id, v_token, p_created_by, p_created_by);

  RETURN v_token;
END;
$$;

-- record_portal_access(token, ip, user_agent)
-- Increments access count and appends IP entry. Called by edge function on every page load.
CREATE OR REPLACE FUNCTION public.record_portal_access(
  p_token text,
  p_ip    text,
  p_ua    text
) RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_found boolean := false;
BEGIN
  UPDATE public.client_portal_tokens
  SET
    access_count     = access_count + 1,
    last_accessed_at = now(),
    ip_log           = ip_log || jsonb_build_object('ip', p_ip, 'ua', p_ua, 'ts', now()::text),
    updated_at       = now()
  WHERE token = p_token AND is_active = true
  RETURNING true INTO v_found;

  RETURN COALESCE(v_found, false);
END;
$$;

-- get_portal_client_id(token)
-- Returns client_id if token is valid and active, NULL otherwise.
-- Edge function calls this to validate every request.
CREATE OR REPLACE FUNCTION public.get_portal_client_id(p_token text)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_client_id uuid;
BEGIN
  SELECT client_id INTO v_client_id
  FROM public.client_portal_tokens
  WHERE token = p_token AND is_active = true;

  RETURN v_client_id;  -- NULL if not found or inactive
END;
$$;

-- init_project_phases(project_id, phase_labels text[])
-- Initializes default phases for a project when portal is enabled.
-- Admin can pass custom labels or use the defaults.
CREATE OR REPLACE FUNCTION public.init_project_phases(
  p_project_id uuid,
  p_labels     text[] DEFAULT ARRAY[
    'Pre-Walk & Site Prep',
    'Demolition',
    'Grading & Base',
    'Installation',
    'Finishing & Punch',
    'Final Walk & Handoff'
  ]
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  i integer;
BEGIN
  -- Only init if no phases exist yet for this project
  IF EXISTS (SELECT 1 FROM public.project_phases WHERE project_id = p_project_id AND is_active = true) THEN
    RETURN;
  END IF;

  FOR i IN 1..array_length(p_labels, 1) LOOP
    INSERT INTO public.project_phases (project_id, label, order_index)
    VALUES (p_project_id, p_labels[i], i - 1);
  END LOOP;
END;
$$;
