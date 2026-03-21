-- ============================================================
-- Migration 003: Roles & Permissions tables
-- ============================================================

-- ── Roles ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.roles (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,   -- machine key, e.g. 'project_manager'
  label      text NOT NULL,          -- display name, e.g. 'Project Manager'
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Permissions ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.permissions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key        text NOT NULL UNIQUE,   -- machine key, e.g. 'can_view_clients'
  label      text NOT NULL,          -- display name, e.g. 'View Clients'
  category   text NOT NULL DEFAULT 'general', -- grouping: clients | projects | financials | admin
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ── Role default permissions ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.role_permissions (
  role_id       uuid NOT NULL REFERENCES public.roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES public.permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE public.roles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read roles & permissions
CREATE POLICY "roles_read"       ON public.roles       FOR SELECT TO authenticated USING (true);
CREATE POLICY "permissions_read" ON public.permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_read" ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- Only admins can manage them
CREATE POLICY "roles_admin"       ON public.roles       FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "permissions_admin" ON public.permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "role_permissions_admin" ON public.role_permissions FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));

-- ── Seed: Roles ──────────────────────────────────────────────
INSERT INTO public.roles (name, label) VALUES
  ('admin',           'Admin'),
  ('project_manager', 'Project Manager'),
  ('sales_rep',       'Sales Rep'),
  ('foreman',         'Foreman')
ON CONFLICT (name) DO NOTHING;

-- ── Seed: Permissions ────────────────────────────────────────
INSERT INTO public.permissions (key, label, category) VALUES
  ('can_view_clients',        'View Clients',        'clients'),
  ('can_edit_clients',        'Edit Clients',        'clients'),
  ('can_view_projects',       'View Projects',       'projects'),
  ('can_edit_projects',       'Edit Projects',       'projects'),
  ('can_create_proposals',    'Create Proposals',    'projects'),
  ('can_view_commissions',    'View Commissions',    'financials'),
  ('can_view_financials',     'View Financials',     'financials'),
  ('can_edit_financials',     'Edit Financials',     'financials'),
  ('can_view_team',           'View Team',           'admin'),
  ('can_manage_products',     'Manage Products',     'admin'),
  ('can_manage_users',        'Manage Users',        'admin'),
  ('can_edit_sold_contracts', 'Edit Sold Contracts', 'projects')
ON CONFLICT (key) DO NOTHING;

-- ── Seed: Role default permissions ───────────────────────────
-- Admin gets everything
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- Project Manager
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'project_manager'
    AND p.key IN ('can_view_clients','can_edit_clients','can_view_projects','can_edit_projects','can_view_commissions','can_view_financials','can_view_team')
ON CONFLICT DO NOTHING;

-- Sales Rep
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key IN ('can_view_clients','can_edit_clients','can_view_projects','can_create_proposals','can_view_commissions')
ON CONFLICT DO NOTHING;

-- Foreman
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'foreman'
    AND p.key IN ('can_view_projects')
ON CONFLICT DO NOTHING;
