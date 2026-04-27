-- Migration 052: Add can_schedule_appointments permission
-- Admin always gets all. Sales Rep needs it to book appointments in the pipeline.
-- PM and Foreman do not schedule appointments.

INSERT INTO public.permissions (key, label, category) VALUES
  ('can_schedule_appointments', 'Schedule Appointments', 'clients')
ON CONFLICT (key) DO NOTHING;

-- Admin gets all permissions automatically via existing pattern
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'admin'
    AND p.key = 'can_schedule_appointments'
ON CONFLICT DO NOTHING;

-- Sales Rep can schedule appointments
INSERT INTO public.role_permissions (role_id, permission_id)
  SELECT r.id, p.id FROM public.roles r, public.permissions p
  WHERE r.name = 'sales_rep'
    AND p.key = 'can_schedule_appointments'
ON CONFLICT DO NOTHING;
