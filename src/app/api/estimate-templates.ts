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

// ─── Wizard material variants (e.g. Gravity Wall block types, paver brands) ─────
export const wizardVariantsAPI = {
  getAll: async () => {
    const { data, error } = await supabase
      .from("wizard_material_variants")
      .select("*")
      .eq("is_active", true)
      .order("wizard_type")
      .order("role")
      .order("sort_order");
    if (error) throw error;
    return data || [];
  },

  create: async (variant: {
    wizard_type: string;
    role: string;
    label: string;
    product_name: string;
    price_override?: number | null;
    linked_cap_role?: string | null;
    is_default?: boolean;
    sort_order?: number;
  }) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("wizard_material_variants")
      .insert({ ...variant, created_by: user?.id, updated_by: user?.id })
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  update: async (id: string, updates: Record<string, unknown>) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("wizard_material_variants")
      .update({ ...updates, updated_by: user?.id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  // Make one variant the default within its (wizard_type, role) group, clearing others
  setDefault: async (id: string, wizard_type: string, role: string) => {
    await supabase
      .from("wizard_material_variants")
      .update({ is_default: false })
      .eq("wizard_type", wizard_type)
      .eq("role", role);
    const { error } = await supabase
      .from("wizard_material_variants")
      .update({ is_default: true })
      .eq("id", id);
    if (error) throw error;
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from("wizard_material_variants")
      .update({ is_active: false })
      .eq("id", id);
    if (error) throw error;
  },
};
