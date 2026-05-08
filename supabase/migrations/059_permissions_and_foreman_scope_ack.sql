-- Migration 059: Permission updates (Jonathan May 6 2026) + Foreman scope acknowledgment
-- All changes are additive. No existing data is modified.

-- ── 1. Sales Rep: grant can_send_docusign
-- Permission already exists (id: 71411f9b-2b1a-4aee-92ac-142657950122)
-- Sales Rep role id: 079311c5-015e-4ec5-b7b4-01903389716d
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key  = 'can_send_docusign'
ON CONFLICT DO NOTHING;

-- ── 2. Project Manager: grant can_schedule_appointments
-- Permission already exists (id: b798c0cb-cd41-4ed8-bf48-7a2d1ce172ae)
-- PM role id: 6ee34ad8-064c-4b0d-b06b-2c63581415e1
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r, public.permissions p
  WHERE r.name = 'project_manager'
    AND p.key  = 'can_schedule_appointments'
ON CONFLICT DO NOTHING;

-- ── 3. New permission: can_update_forecast
-- Separate from can_move_pipeline_stage so Sales Rep can update forecast
-- without being able to move pipeline stages
INSERT INTO public.permissions (key, label, category)
  VALUES ('can_update_forecast', 'Update Forecast', 'clients')
ON CONFLICT (key) DO NOTHING;

-- Grant to admin (gets all permissions)
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r, public.permissions p
  WHERE r.name = 'admin'
    AND p.key  = 'can_update_forecast'
ON CONFLICT DO NOTHING;

-- Grant to sales_rep (Jonathan Q4: Yes)
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id
  FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key  = 'can_update_forecast'
ON CONFLICT DO NOTHING;

-- ── 4. field_installation_orders: scope acknowledgment columns (Foreman F3)
-- Foreman taps "Acknowledge Scope" once before starting work
-- Null = not yet acknowledged
ALTER TABLE public.field_installation_orders
  ADD COLUMN IF NOT EXISTS scope_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS scope_acknowledged_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL;
