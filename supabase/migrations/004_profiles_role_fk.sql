-- ============================================================
-- Migration 004: Link profiles.role to roles table via FK
-- ============================================================

-- 1. Ensure all role values that profiles currently use exist in roles table
INSERT INTO public.roles (name, label) VALUES
  ('team_member', 'Team Member')
ON CONFLICT (name) DO NOTHING;

-- 2. Drop the old hardcoded CHECK constraint on profiles.role
ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 3. Add FK constraint — profiles.role references roles.name
--    (roles.name has UNIQUE constraint so it can be referenced)
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_fkey
  FOREIGN KEY (role) REFERENCES public.roles(name)
  ON UPDATE CASCADE   -- if role name changes, profiles update too
  ON DELETE RESTRICT; -- can't delete a role that has users

-- 4. Update handle_new_user trigger to store all permissions
--    by fetching defaults from role_permissions table
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role        text;
  v_permissions jsonb;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'team_member');

  -- If permissions were passed in metadata, use them
  -- Otherwise build from role_permissions defaults
  IF new.raw_user_meta_data ? 'permissions' THEN
    v_permissions := new.raw_user_meta_data->'permissions';
  ELSE
    -- Build permissions object from role_permissions table
    SELECT jsonb_object_agg(p.key, true)
    INTO v_permissions
    FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = v_role;

    -- Default all other permissions to false
    SELECT v_permissions || jsonb_object_agg(p.key, false)
    INTO v_permissions
    FROM public.permissions p
    WHERE NOT (v_permissions ? p.key);
  END IF;

  -- Fallback if still null
  IF v_permissions IS NULL THEN
    SELECT jsonb_object_agg(p.key, false)
    INTO v_permissions
    FROM public.permissions p;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'name', ' ', 1), 'User'),
    COALESCE(new.raw_user_meta_data->>'last_name',  split_part(new.raw_user_meta_data->>'name', ' ', 2), ''),
    v_role,
    v_permissions
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
