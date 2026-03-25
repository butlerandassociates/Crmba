import { supabase } from "@/lib/supabase";

export const estimateTemplatesAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("estimate_templates")
      .select("*")
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return data || [];
  },

  getById: async (id: string) => {
    const { data, error } = await supabase
      .from("estimate_templates")
      .select("*")
      .eq("id", id)
      .single();
    if (error) throw error;
    return data;
  },

  getByCategory: async (category: string) => {
    const { data, error } = await supabase
      .from("estimate_templates")
      .select("*")
      .eq("category", category)
      .eq("is_active", true)
      .single();
    if (error && error.code !== "PGRST116") throw error;
    return data || null;
  },

  create: async (template: {
    name: string;
    category: string;
    description?: string;
    steps: any[];
    calc_rules: any[];
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("estimate_templates")
      .insert({ ...template, created_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: {
    name?: string;
    category?: string;
    description?: string;
    steps?: any[];
    calc_rules?: any[];
    is_active?: boolean;
  }) => {
    const { data, error } = await supabase
      .from("estimate_templates")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("estimate_templates")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
  },
};
