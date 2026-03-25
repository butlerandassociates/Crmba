import { supabase } from "@/lib/supabase";

export const activityLogAPI = {
  getByClient: async (clientId: string) => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*, performer:profiles(first_name, last_name)")
      .eq("client_id", clientId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  getByProject: async (projectId: string) => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("*, performer:profiles(first_name, last_name)")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  create: async (log: {
    client_id?: string;
    project_id?: string;
    action_type: string;
    description: string;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("activity_log")
      .insert({ ...log, performed_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },
};
