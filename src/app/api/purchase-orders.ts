/**
 * Purchase Orders API
 * Material purchase orders per project, sent to suppliers.
 */

import { supabase } from "@/lib/supabase";

export const purchaseOrdersAPI = {
  /** All POs for a client */
  getByClient: async (client_id: string) => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`*, items:purchase_order_items(*)`)
      .eq("client_id", client_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** All POs for a project */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .select(`*, items:purchase_order_items(*), sent_by:profiles!purchase_orders_sent_by_user_id_fkey(id, first_name, last_name, phone, email)`)
      .eq("project_id", project_id)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Create a PO with items */
  create: async (
    po: { project_id: string; supplier_name: string; delivery_address?: string; delivery_date?: string; notes?: string },
    items: { product_id?: string; product_name: string; quantity: number; unit: string; sort_order?: number }[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();

    // Get sent_by profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user?.id)
      .single();

    const { data: created, error } = await supabase
      .from("purchase_orders")
      .insert({ ...po, created_by: user?.id, sent_by_user_id: profile?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("purchase_order_items")
        .insert(items.map((item, i) => ({ ...item, po_id: created.id, sort_order: item.sort_order ?? i })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return created;
  },

  /** Update PO fields */
  update: async (id: string, updates: { supplier_name?: string; delivery_address?: string; delivery_date?: string; status?: string; notes?: string }) => {
    const { data, error } = await supabase
      .from("purchase_orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Replace all items on a PO */
  updateItems: async (
    po_id: string,
    items: { product_id?: string; product_name: string; quantity: number; unit: string }[]
  ) => {
    await supabase.from("purchase_order_items").delete().eq("po_id", po_id);
    if (items.length > 0) {
      const { error } = await supabase
        .from("purchase_order_items")
        .insert(items.map((item, i) => ({ ...item, po_id, sort_order: i })));
      if (error) throw new Error(error.message);
    }
  },

  /** Delete a PO */
  delete: async (id: string) => {
    const { error } = await supabase.from("purchase_orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
