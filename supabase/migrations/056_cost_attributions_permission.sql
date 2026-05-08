-- Migration 056: Add can_view_cost_attributions permission and assign to admin

INSERT INTO public.permissions (key, label, category) VALUES
  ('can_view_cost_attributions', 'View Cost Attributions', 'financials')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'admin'
    AND p.key = 'can_view_cost_attributions'
ON CONFLICT DO NOTHING;
