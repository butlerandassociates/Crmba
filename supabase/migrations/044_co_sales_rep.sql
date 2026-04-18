-- Migration 044: Grant can_create_change_orders to Sales Rep
-- Jonathan confirmed 2026-04-19: Admin + PM + Sales Rep all can create COs

INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key = 'can_create_change_orders'
ON CONFLICT DO NOTHING;
