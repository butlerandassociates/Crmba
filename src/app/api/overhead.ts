import { supabase } from "@/lib/supabase";

export interface OverheadCost {
  id: string;
  name: string;
  amount: number;
  is_recurring: boolean;
  recurring_frequency: "monthly" | "quarterly" | "yearly" | null;
  date: string;
  parent_id: string | null;
  created_at: string;
  created_by: string | null;
}

const coerce = (r: any): OverheadCost => ({ ...r, amount: Number(r.amount) });

export const overheadAPI = {
  getAll: async (): Promise<OverheadCost[]> => {
    const { data, error } = await supabase
      .from("overhead_costs")
      .select("*")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map(coerce);
  },

  create: async (item: {
    name: string;
    amount: number;
    is_recurring: boolean;
    recurring_frequency: string | null;
    date: string;
    parent_id: string | null;
  }): Promise<OverheadCost> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("overhead_costs")
      .insert({ ...item, created_by: user?.id, updated_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return coerce(data);
  },

  update: async (
    id: string,
    updates: {
      name?: string;
      amount?: number;
      is_recurring?: boolean;
      recurring_frequency?: string | null;
      date?: string;
    }
  ): Promise<OverheadCost> => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("overhead_costs")
      .update({ ...updates, updated_by: user?.id })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return coerce(data);
  },

  delete: async (id: string): Promise<void> => {
    const { error } = await supabase
      .from("overhead_costs")
      .delete()
      .eq("id", id);
    if (error) throw new Error(error.message);
  },
};
