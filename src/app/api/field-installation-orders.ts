/**
 * Field Installation Orders API
 * Tracks labor assignments per project foreman.
 */

import { supabase } from "@/lib/supabase";

export const fioAPI = {
  /** Get all FIOs for a project (multiple crews supported) */
  getByProject: async (project_id: string) => {
    const { data, error } = await supabase
      .from("field_installation_orders")
      .select(`*, items:field_installation_order_items(*), foreman:profiles!field_installation_orders_foreman_id_fkey(id, first_name, last_name, phone, is_active)`)
      .eq("project_id", project_id)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  /** Create a new FIO with items */
  create: async (
    fio: { project_id: string; foreman_id?: string; notes?: string; work_date?: string },
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
        .insert(items.map((item: any, i) => {
          const { id, ...rest } = item;
          return { ...rest, fio_id: created.id, sort_order: rest.sort_order ?? i };
        }));
      if (itemsError) throw new Error(itemsError.message);
    }
    return created;
  },

  /** Update FIO status or notes */
  update: async (id: string, updates: { status?: string; foreman_id?: string; notes?: string; work_date?: string | null; approved_by?: string; approved_date?: string; paid_date?: string; completed_by?: string | null; completed_at?: string | null }) => {
    const { data, error } = await supabase
      .from("field_installation_orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return data;
  },

  /** Update items on an FIO — preserves existing item IDs so fio_crew_payments history stays linked */
  updateItems: async (
    fio_id: string,
    items: { id?: string; product_name: string; unit: string; quantity: number; labor_cost_per_unit: number; notes?: string }[]
  ) => {
    // Separate existing (real UUID) from new (temp "new-*" IDs)
    const existing = items.filter((i) => i.id && !String(i.id).startsWith("new-"));
    const added    = items.filter((i) => !i.id || String(i.id).startsWith("new-"));

    // Find items that were removed so we can delete them
    const { data: dbItems } = await supabase
      .from("field_installation_order_items")
      .select("id")
      .eq("fio_id", fio_id);
    const keptIds  = new Set(existing.map((i) => i.id));
    const toDelete = (dbItems ?? []).filter((d: any) => !keptIds.has(d.id)).map((d: any) => d.id);

    // UPDATE existing items in-place — preserves UUIDs so crew payment history stays valid
    await Promise.all(
      existing.map((item) =>
        supabase
          .from("field_installation_order_items")
          .update({
            product_name: item.product_name,
            unit: item.unit,
            quantity: item.quantity,
            labor_cost_per_unit: item.labor_cost_per_unit,
            notes: item.notes || "",
            sort_order: items.indexOf(item),
          })
          .eq("id", item.id)
      )
    );

    // INSERT new items
    if (added.length > 0) {
      const { error } = await supabase.from("field_installation_order_items").insert(
        added.map((item) => ({
          fio_id,
          product_name: item.product_name,
          unit: item.unit,
          quantity: item.quantity,
          labor_cost_per_unit: item.labor_cost_per_unit,
          notes: item.notes || "",
          sort_order: items.indexOf(item),
        }))
      );
      if (error) throw new Error(error.message);
    }

    // DELETE removed items
    if (toDelete.length > 0) {
      await supabase.from("field_installation_order_items").delete().in("id", toDelete);
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
