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
};

export const permissionsAPI = {
  /** All permissions grouped by category */
  getAll: async () => {
    const { data, error } = await supabase
      .from("permissions")
      .select("*")
      .order("category")
      .order("label");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Default permission keys for a given role name */
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
