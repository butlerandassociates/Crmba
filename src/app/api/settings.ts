/**
 * Settings API
 * Company settings, email templates, roles, permissions.
 */

import { supabase } from "@/lib/supabase";

export const companySettingsAPI = {
  /** Get company profile (single row) */
  get: async () => {
    const { data, error } = await supabase
      .from("company_settings")
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update company settings */
  update: async (settings: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("company_settings")
      .update(settings)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

export const emailTemplatesAPI = {
  /** All active email templates */
  getAll: async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create or update a template */
  save: async (template: Record<string, unknown>) => {
    if (template.id) {
      const { id, ...rest } = template;
      const { data, error } = await supabase
        .from("email_templates")
        .update(rest)
        .eq("id", id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return data;
    }
    const { data, error } = await supabase
      .from("email_templates")
      .insert(template)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft-delete by deactivating */
  delete: async (id: string) => {
    const { data, error } = await supabase
      .from("email_templates")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },
};

export const rolesAPI = {
  /** All active roles */
  getAll: async () => {
    const { data, error } = await supabase
      .from("roles")
      .select("*")
      .eq("is_active", true)
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  create: async (label: string) => {
    const name = label.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    const { data, error } = await supabase
      .from("roles")
      .insert({ name, label, is_active: true })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, label: string, name?: string) => {
    const updates: Record<string, string> = { label };
    if (name) updates.name = name;
    const { data, error } = await supabase
      .from("roles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("roles").update({ is_active: false }).eq("id", id);
    if (error) throw new Error(error.message);
  },
};

export const permissionsAPI = {
  /** All permissions ordered by category then label */
  getAll: async () => {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("category")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  create: async (key: string, label: string, category: string) => {
    const { data, error } = await supabase
      .from("permissions")
      .insert({ key, label, category })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, updates: { key?: string; label?: string; category?: string }) => {
    const { data, error } = await supabase
      .from("permissions")
      .update(updates)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase.from("permissions").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },

  /** Get permission IDs assigned to a role */
  getRolePermissions: async (roleId: string): Promise<string[]> => {
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission_id")
      .eq("role_id", roleId);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.permission_id as string);
  },

  /** Assign or unassign a permission from a role */
  setRolePermission: async (roleId: string, permissionId: string, enabled: boolean) => {
    if (enabled) {
      const { error } = await supabase
        .from("role_permissions")
        .upsert({ role_id: roleId, permission_id: permissionId });
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase
        .from("role_permissions")
        .delete()
        .eq("role_id", roleId)
        .eq("permission_id", permissionId);
      if (error) throw new Error(error.message);
    }
  },

  /** Default permission keys for a given role name (legacy) */
  getDefaultsForRole: async (roleName: string) => {
    const { data: role } = await supabase
      .from("roles")
      .select("id")
      .eq("name", roleName)
      .single();
    if (!role) return [];
    const { data, error } = await supabase
      .from("role_permissions")
      .select("permission:permissions(key)")
      .eq("role_id", role.id);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r: any) => r.permission?.key).filter(Boolean);
  },
};
