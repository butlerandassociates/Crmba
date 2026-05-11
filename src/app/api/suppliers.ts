import { supabase } from "@/lib/supabase";

export interface Supplier {
  id: string;
  supplier_name: string;
  poc_name: string | null;
  email: string | null;
  created_at: string;
  updated_at: string;
}

export const suppliersAPI = {
  getAll: async (): Promise<Supplier[]> => {
    const { data, error } = await supabase
      .from("suppliers")
      .select("*")
      .order("supplier_name", { ascending: true });
    if (error) throw new Error(error.message);
    return data || [];
  },

  create: async (payload: { supplier_name: string; poc_name?: string; email?: string }): Promise<Supplier> => {
    const { data, error } = await supabase
      .from("suppliers")
      .insert({ ...payload, updated_at: new Date().toISOString() })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  update: async (id: string, payload: { supplier_name?: string; poc_name?: string; email?: string }): Promise<Supplier> => {
    const { data, error } = await supabase
      .from("suppliers")
      .update({ ...payload, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
