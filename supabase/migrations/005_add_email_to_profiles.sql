-- ============================================================
-- Migration 005: Add email column to profiles
-- ============================================================

-- 1. Add email column
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS email text;

-- 2. Backfill existing profiles from auth.users
UPDATE public.profiles p
SET email = u.email
FROM auth.users u
WHERE p.id = u.id;

-- 3. Update handle_new_user trigger to also store email
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  v_role        text;
  v_permissions jsonb;
BEGIN
  v_role := COALESCE(new.raw_user_meta_data->>'role', 'team_member');

  IF new.raw_user_meta_data ? 'permissions' THEN
    v_permissions := new.raw_user_meta_data->'permissions';
  ELSE
    SELECT jsonb_object_agg(p.key, true)
    INTO v_permissions
    FROM public.role_permissions rp
    JOIN public.roles r ON r.id = rp.role_id
    JOIN public.permissions p ON p.id = rp.permission_id
    WHERE r.name = v_role;

    SELECT v_permissions || jsonb_object_agg(p.key, false)
    INTO v_permissions
    FROM public.permissions p
    WHERE NOT (v_permissions ? p.key);
  END IF;

  IF v_permissions IS NULL THEN
    SELECT jsonb_object_agg(p.key, false)
    INTO v_permissions
    FROM public.permissions p;
  END IF;

  INSERT INTO public.profiles (id, first_name, last_name, role, permissions, email)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'first_name', split_part(new.raw_user_meta_data->>'name', ' ', 1), 'User'),
    COALESCE(new.raw_user_meta_data->>'last_name',  split_part(new.raw_user_meta_data->>'name', ' ', 2), ''),
    v_role,
    v_permissions,
    new.email
  );

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
