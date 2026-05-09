import { supabase } from "@/lib/supabase";

const attachPerformers = async (rows: any[]) => {
  const ids = [...new Set(rows.map((r) => r.performed_by).filter(Boolean))];
  if (ids.length === 0) return rows;
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, first_name, last_name, role")
    .in("id", ids);
  const map: Record<string, any> = {};
  (profiles ?? []).forEach((p) => { map[p.id] = p; });
  return rows.map((r) => ({ ...r, performer: r.performed_by ? (map[r.performed_by] ?? null) : null }));
};

const ACTIVITY_PAGE_SIZE = 20;

export const activityLogAPI = {
  getByClient: async (clientId: string, page = 0) => {
    const from = page * ACTIVITY_PAGE_SIZE;
    const to   = from + ACTIVITY_PAGE_SIZE - 1;
    const { data, error, count } = await supabase
      .from("activity_log")
      .select("id, client_id, action_type, description, performed_by, created_at", { count: "exact" })
      .eq("client_id", clientId)
      .order("created_at", { ascending: false })
      .range(from, to);
    if (error) throw error;
    const withPerformers = await attachPerformers(data || []);
    const total = count ?? 0;
    return { data: withPerformers, hasMore: total > (page + 1) * ACTIVITY_PAGE_SIZE, total };
  },

  getByProject: async (projectId: string) => {
    const { data, error } = await supabase
      .from("activity_log")
      .select("id, project_id, action_type, description, performed_by, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return attachPerformers(data || []);
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
