/**
 * Change Orders API
 * Project scope changes sent to clients for approval.
 */

import { supabase } from "@/lib/supabase";

export const changeOrdersAPI = {
  /** All COs for a client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("change_orders")
      .select(`*, items:change_order_items(*)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Create a CO with items */
  create: async (
    co: { client_id: string; project_id?: string; title: string; reason?: string; timeline_impact?: string; status?: string },
    items: { category: string; description: string; quantity: number; unit_price: number; total: number }[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const costImpact = items.reduce((s, i) => s + i.total, 0);

    const { data: created, error } = await supabase
      .from("change_orders")
      .insert({ ...co, cost_impact: costImpact, submitted_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("change_order_items")
        .insert(items.map((item, i) => ({ ...item, co_id: created.id, sort_order: i })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return created;
  },

  /** Update CO status */
  updateStatus: async (id: string, status: string) => {
    const { data, error } = await supabase
      .from("change_orders")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Delete a CO */
  delete: async (id: string) => {
    const { error } = await supabase.from("change_orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
