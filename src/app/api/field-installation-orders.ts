/**
 * Field Installation Orders API
 * Tracks labor assignments per project foreman.
 */

import { supabase } from "@/lib/supabase";

export const fioAPI = {
  /** Get FIO for a project (one per project) */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("field_installation_orders")
      .select(`*, items:field_installation_order_items(*), foreman:profiles!field_installation_orders_foreman_id_fkey(id, first_name, last_name, phone)`)
      .eq("project_id", project_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Create a new FIO with items */
  create: async (
    fio: { project_id: string; foreman_id?: string; notes?: string },
    items: { product_name: string; unit: string; quantity: number; labor_cost_per_unit: number; notes?: string; sort_order?: number }[]
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { data: created, error } = await supabase
      .from("field_installation_orders")
      .insert({ ...fio, created_by: user?.id })
      .select()
      .single();
    if (error) throw new Error(error.message);

    if (items.length > 0) {
      const { error: itemsError } = await supabase
        .from("field_installation_order_items")
        .insert(items.map((item, i) => ({ ...item, fio_id: created.id, sort_order: item.sort_order ?? i })));
      if (itemsError) throw new Error(itemsError.message);
    }
    return created;
  },

  /** Update FIO status or notes */
  update: async (id: string, updates: { status?: string; foreman_id?: string; notes?: string }) => {
    const { data, error } = await supabase
      .from("field_installation_orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Replace all items on an FIO */
  updateItems: async (
    fio_id: string,
    items: { product_name: string; unit: string; quantity: number; labor_cost_per_unit: number; notes?: string }[]
  ) => {
    await supabase.from("field_installation_order_items").delete().eq("fio_id", fio_id);
    if (items.length > 0) {
      const { error } = await supabase
        .from("field_installation_order_items")
        .insert(items.map((item, i) => ({ ...item, fio_id, sort_order: i })));
      if (error) throw new Error(error.message);
    }
  },

  /** Record a weekly crew payment batch */
  recordCrewPayment: async (
    fio_id: string,
    week_ending_date: string,
    entries: { fio_item_id: string; completion_pct: number; amount_paid: number }[],
    notes?: string
  ) => {
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("fio_crew_payments")
      .insert(
        entries.map((e) => ({
          fio_id,
          fio_item_id: e.fio_item_id,
          week_ending_date,
          completion_pct: e.completion_pct,
          amount_paid: e.amount_paid,
          paid_by: user?.id,
          notes: notes || null,
        }))
      );
    if (error) throw new Error(error.message);
  },

  /** Get all crew payment history for an FIO */
  getCrewPayments: async (fio_id: string) => {
    const { data, error } = await supabase
      .from("fio_crew_payments")
      .select("*, paidBy:profiles!fio_crew_payments_paid_by_fkey(first_name, last_name)")
      .eq("fio_id", fio_id)
      .order("week_ending_date", { ascending: false })
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data || [];
  },

  /** Delete an FIO and all its items (cascade) */
  delete: async (id: string) => {
    const { error } = await supabase.from("field_installation_orders").delete().eq("id", id);
    if (error) throw new Error(error.message);
  },
};
