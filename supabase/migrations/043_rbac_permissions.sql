-- Migration 043: RBAC — Add meaningful permissions + correct role assignments
-- Only gates where roles actually differ. Skip universal view permissions.

-- 1. Insert new permissions
INSERT INTO public.permissions (key, label, category) VALUES
  ('can_view_pipeline',          'View Pipeline/Stats',         'admin'),
  ('can_view_admin_portal',      'View Admin Portal',           'admin'),
  ('can_view_integrations',      'View Integrations',           'admin'),
  ('can_manage_settings',        'Manage Settings',             'admin'),
  ('can_manage_team',            'Manage Team',                 'admin'),
  ('can_manage_permissions',     'Manage Permissions',          'admin'),
  ('can_view_payroll',           'View Payroll',                'financials'),
  ('can_send_proposals',         'Send Proposals',              'projects'),
  ('can_send_docusign',          'Send DocuSign',               'projects'),
  ('can_create_change_orders',   'Create Change Orders',        'projects'),
  ('can_approve_change_orders',  'Approve Change Orders',       'projects'),
  ('can_approve_purchase_orders','Approve Purchase Orders',     'projects'),
  ('can_confirm_811',            'Confirm 811 Call',            'projects'),
  ('can_move_pipeline_stage',    'Move Pipeline Stage',         'clients'),
  ('can_record_payments',        'Record Payments',             'financials')
ON CONFLICT (key) DO NOTHING;

-- 2. Admin gets ALL permissions (including all new ones)
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'admin'
ON CONFLICT DO NOTHING;

-- 3. Fix PM — remove can_view_financials (incorrectly assigned in migration 003)
DELETE FROM public.role_permissions
  WHERE role_id  = (SELECT id FROM public.roles       WHERE name = 'project_manager')
    AND permission_id = (SELECT id FROM public.permissions WHERE key  = 'can_view_financials');

-- 4. PM — add create COs + confirm 811
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'project_manager'
    AND p.key IN ('can_create_change_orders', 'can_confirm_811')
ON CONFLICT DO NOTHING;

-- 5. Sales Rep — add send proposals
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key IN ('can_send_proposals')
ON CONFLICT DO NOTHING;
