/**
 * Team API
 * Manage profiles (team members) — project managers, foremen, sales reps.
 */

import { supabase } from "@/lib/supabase";

export const usersAPI = {
  /** All active team members with their active project count */
  getAll: async () => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("is_active", true)
      .order("first_name");
    if (error) throw new Error(error.message);

    const { data: projects } = await supabase
      .from("projects")
      .select("project_manager_id, foreman_id, sales_rep_id, status");

    return (data ?? []).map((u: any) => {
      const activeProjects = (projects ?? []).filter(
        (p: any) =>
          ["active", "sold", "selling"].includes(p.status) &&
          (p.project_manager_id === u.id || p.foreman_id === u.id || p.sales_rep_id === u.id)
      ).length;
      return { ...u, activeProjects };
    });
  },

  /** Team members filtered by role — for assignment dropdowns */
  getByRole: async (role: "project_manager" | "foreman" | "sales_rep" | "admin") => {
    const { data, error } = await supabase
      .from("profiles")
      .select("id, first_name, last_name, phone, email")
      .eq("role", role)
      .eq("is_active", true)
      .order("first_name");
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Single team member */
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update profile details (name, phone, etc.) */
  update: async (id: string, profile: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .update(profile)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create a profile record (used after Supabase Auth invite is accepted) */
  create: async (profile: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("profiles")
      .insert(profile)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Soft-deactivate — hides from team list and dropdowns, nulls out project assignments */
  deactivate: async (id: string) => {
    // Null out any project/FIO assignments so deleted users don't persist as ghost assignees
    await Promise.all([
      supabase.from("projects").update({ foreman_id: null }).eq("foreman_id", id),
      supabase.from("projects").update({ project_manager_id: null }).eq("project_manager_id", id),
      supabase.from("projects").update({ sales_rep_id: null }).eq("sales_rep_id", id),
      supabase.from("field_installation_orders").update({ foreman_id: null }).eq("foreman_id", id),
    ]);
    const { data, error } = await supabase
      .from("profiles")
      .update({ is_active: false })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Hard delete — nulls out assignments, cleans up profile-files storage */
  delete: async (id: string) => {
    // Null out any project/FIO assignments before deletion to prevent dangling references
    await Promise.all([
      supabase.from("projects").update({ foreman_id: null }).eq("foreman_id", id),
      supabase.from("projects").update({ project_manager_id: null }).eq("project_manager_id", id),
      supabase.from("projects").update({ sales_rep_id: null }).eq("sales_rep_id", id),
      supabase.from("field_installation_orders").update({ foreman_id: null }).eq("foreman_id", id),
    ]);
    const { data: files } = await supabase
      .from("profile_files")
      .select("url")
      .eq("profile_id", id);
    if (files && files.length > 0) {
      const paths = files
        .map((f: any) => f.url?.split("/profile-files/")[1])
        .filter(Boolean);
      if (paths.length > 0) await supabase.storage.from("profile-files").remove(paths);
    }
    const { error } = await supabase.from("profiles").delete().eq("id", id);
    if (error) throw new Error(error.message);
    return { id };
  },
};
